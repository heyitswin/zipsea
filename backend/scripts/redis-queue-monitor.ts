#!/usr/bin/env tsx

/**
 * Redis Queue Monitoring Tool
 * 
 * Monitors Bull queues for webhook and bulk processing jobs
 * Provides real-time status of Redis queues and job processing
 * 
 * Usage:
 *   npm run tsx scripts/redis-queue-monitor.ts
 *   npm run tsx scripts/redis-queue-monitor.ts -- --live
 *   npm run tsx scripts/redis-queue-monitor.ts -- --queue BulkCruiseProcessingQueue
 */

import { createClient } from 'redis';
import chalk from 'chalk';
import { logger } from '../src/config/logger';

interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

interface JobInfo {
  id: string;
  name: string;
  data: any;
  progress: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  attemptsMade: number;
}

class RedisQueueMonitor {
  private client: any;
  private isConnected = false;
  private isRunning = false;
  private queues = [
    'BulkCruiseProcessingQueue',
    'WebhookQueue',
    'PriceHistoryQueue'
  ];

  async connect(): Promise<void> {
    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.client.on('error', (err: any) => {
        console.error(chalk.red('Redis connection error:'), err.message);
      });

      this.client.on('connect', () => {
        console.log(chalk.green('✅ Connected to Redis'));
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log(chalk.yellow('⚠️ Disconnected from Redis'));
        this.isConnected = false;
      });

      await this.client.connect();
    } catch (error) {
      console.error(chalk.red('❌ Failed to connect to Redis:'), error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
    }
  }

  async getQueueStats(queueName: string): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        this.client.lLen(`bull:${queueName}:waiting`),
        this.client.lLen(`bull:${queueName}:active`),
        this.client.lLen(`bull:${queueName}:completed`),
        this.client.lLen(`bull:${queueName}:failed`),
        this.client.lLen(`bull:${queueName}:delayed`),
        this.client.lLen(`bull:${queueName}:paused`)
      ]);

      return {
        name: queueName,
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused
      };
    } catch (error) {
      logger.error(`Error getting stats for queue ${queueName}:`, error);
      return {
        name: queueName,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0
      };
    }
  }

  async getActiveJobs(queueName: string, limit = 10): Promise<JobInfo[]> {
    try {
      const activeJobs = await this.client.lRange(`bull:${queueName}:active`, 0, limit - 1);
      const jobs: JobInfo[] = [];

      for (const jobId of activeJobs) {
        try {
          const jobData = await this.client.hGetAll(`bull:${queueName}:${jobId}`);
          if (jobData && Object.keys(jobData).length > 0) {
            jobs.push({
              id: jobId,
              name: jobData.name || 'Unknown',
              data: JSON.parse(jobData.data || '{}'),
              progress: parseInt(jobData.progress || '0'),
              processedOn: jobData.processedOn ? parseInt(jobData.processedOn) : undefined,
              attemptsMade: parseInt(jobData.attemptsMade || '0')
            });
          }
        } catch (jobError) {
          // Skip invalid job data
        }
      }

      return jobs;
    } catch (error) {
      logger.error(`Error getting active jobs for ${queueName}:`, error);
      return [];
    }
  }

  async getFailedJobs(queueName: string, limit = 5): Promise<JobInfo[]> {
    try {
      const failedJobs = await this.client.lRange(`bull:${queueName}:failed`, 0, limit - 1);
      const jobs: JobInfo[] = [];

      for (const jobId of failedJobs) {
        try {
          const jobData = await this.client.hGetAll(`bull:${queueName}:${jobId}`);
          if (jobData && Object.keys(jobData).length > 0) {
            jobs.push({
              id: jobId,
              name: jobData.name || 'Unknown',
              data: JSON.parse(jobData.data || '{}'),
              progress: parseInt(jobData.progress || '0'),
              finishedOn: jobData.finishedOn ? parseInt(jobData.finishedOn) : undefined,
              failedReason: jobData.failedReason,
              attemptsMade: parseInt(jobData.attemptsMade || '0')
            });
          }
        } catch (jobError) {
          // Skip invalid job data
        }
      }

      return jobs;
    } catch (error) {
      logger.error(`Error getting failed jobs for ${queueName}:`, error);
      return [];
    }
  }

  async getRedisInfo(): Promise<any> {
    try {
      const info = await this.client.info();
      const lines = info.split('\r\n');
      const parsed: any = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            parsed[key] = value;
          }
        }
      }

      return {
        memory: parsed.used_memory_human,
        connections: parsed.connected_clients,
        operations: parsed.total_commands_processed,
        uptime: parsed.uptime_in_seconds,
        version: parsed.redis_version
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  async displayStatus(): Promise<void> {
    console.clear();
    console.log(chalk.cyan('🔄 Redis Queue Monitor - ' + new Date().toLocaleString()));
    console.log(chalk.gray('='.repeat(80)));

    if (!this.isConnected) {
      console.log(chalk.red('❌ Not connected to Redis'));
      return;
    }

    // Redis server info
    const redisInfo = await this.getRedisInfo();
    console.log(chalk.blue('📊 REDIS SERVER INFO'));
    console.log(chalk.gray('-'.repeat(40)));
    if (redisInfo.error) {
      console.log(chalk.red(`❌ Error: ${redisInfo.error}`));
    } else {
      console.log(`💾 Memory Usage: ${chalk.white(redisInfo.memory)}`);
      console.log(`🔗 Connections: ${chalk.white(redisInfo.connections)}`);
      console.log(`📈 Total Operations: ${chalk.white(redisInfo.operations)}`);
      console.log(`⏰ Uptime: ${chalk.white(Math.floor(redisInfo.uptime / 3600))}h ${Math.floor((redisInfo.uptime % 3600) / 60)}m`);
      console.log(`🏷️  Version: ${chalk.white(redisInfo.version)}`);
    }
    console.log('');

    // Queue statistics
    console.log(chalk.magenta('📋 QUEUE STATISTICS'));
    console.log(chalk.gray('-'.repeat(40)));
    
    for (const queueName of this.queues) {
      const stats = await this.getQueueStats(queueName);
      const totalJobs = stats.waiting + stats.active + stats.completed + stats.failed;
      
      console.log(chalk.cyan(`\n📦 ${queueName}`));
      console.log(`   ⏳ Waiting: ${chalk.yellow(stats.waiting.toString().padStart(4))}`);
      console.log(`   🏃 Active:  ${chalk.green(stats.active.toString().padStart(4))}`);
      console.log(`   ✅ Completed: ${chalk.blue(stats.completed.toString().padStart(4))}`);
      console.log(`   ❌ Failed:  ${chalk.red(stats.failed.toString().padStart(4))}`);
      if (stats.delayed > 0) {
        console.log(`   ⏰ Delayed: ${chalk.gray(stats.delayed.toString().padStart(4))}`);
      }
      if (stats.paused > 0) {
        console.log(`   ⏸️  Paused:  ${chalk.gray(stats.paused.toString().padStart(4))}`);
      }
      console.log(`   📊 Total:   ${chalk.white(totalJobs.toString().padStart(4))}`);

      // Health indicator
      if (stats.failed > stats.completed * 0.1) {
        console.log(`   🚨 ${chalk.red('High failure rate!')}`);
      } else if (stats.waiting > 50) {
        console.log(`   ⚠️  ${chalk.yellow('Large queue backlog')}`);
      } else if (stats.active > 0) {
        console.log(`   💚 ${chalk.green('Processing jobs')}`);
      }
    }

    console.log('');

    // Active jobs details
    console.log(chalk.green('🏃 ACTIVE JOBS'));
    console.log(chalk.gray('-'.repeat(40)));
    
    let hasActiveJobs = false;
    for (const queueName of this.queues) {
      const activeJobs = await this.getActiveJobs(queueName, 5);
      if (activeJobs.length > 0) {
        hasActiveJobs = true;
        console.log(chalk.cyan(`\n${queueName}:`));
        for (const job of activeJobs) {
          const progress = job.progress > 0 ? ` (${job.progress}%)` : '';
          const duration = job.processedOn ? 
            ` - ${Math.floor((Date.now() - job.processedOn) / 1000)}s` : '';
          const lineId = job.data?.lineId || job.data?.line_id || '';
          const lineInfo = lineId ? ` Line ${lineId}` : '';
          
          console.log(`   🔄 ${job.id}: ${job.name}${lineInfo}${progress}${duration}`);
        }
      }
    }
    
    if (!hasActiveJobs) {
      console.log(chalk.gray('   No active jobs'));
    }

    // Failed jobs
    console.log(chalk.red('\n❌ RECENT FAILED JOBS'));
    console.log(chalk.gray('-'.repeat(40)));
    
    let hasFailedJobs = false;
    for (const queueName of this.queues) {
      const failedJobs = await this.getFailedJobs(queueName, 3);
      if (failedJobs.length > 0) {
        hasFailedJobs = true;
        console.log(chalk.cyan(`\n${queueName}:`));
        for (const job of failedJobs) {
          const failedTime = job.finishedOn ? 
            new Date(job.finishedOn).toLocaleTimeString() : 'Unknown';
          const attempts = job.attemptsMade > 1 ? ` (${job.attemptsMade} attempts)` : '';
          const lineId = job.data?.lineId || job.data?.line_id || '';
          const lineInfo = lineId ? ` Line ${lineId}` : '';
          
          console.log(`   💥 ${job.id}: ${job.name}${lineInfo}${attempts} - ${failedTime}`);
          if (job.failedReason) {
            console.log(`      ${chalk.gray(job.failedReason.substring(0, 80))}${job.failedReason.length > 80 ? '...' : ''}`);
          }
        }
      }
    }
    
    if (!hasFailedJobs) {
      console.log(chalk.gray('   No recent failed jobs'));
    }

    console.log('');
    console.log(chalk.gray('-'.repeat(80)));
  }

  async monitorSpecificQueue(queueName: string): Promise<void> {
    console.log(chalk.cyan(`🎯 Monitoring Queue: ${queueName}`));
    console.log(chalk.gray('='.repeat(50)));

    const stats = await this.getQueueStats(queueName);
    const activeJobs = await this.getActiveJobs(queueName, 10);
    const failedJobs = await this.getFailedJobs(queueName, 10);

    // Queue stats
    console.log(chalk.blue('📊 Queue Statistics:'));
    Object.entries(stats).forEach(([key, value]) => {
      if (key !== 'name') {
        console.log(`   ${key}: ${value}`);
      }
    });

    // Active jobs
    if (activeJobs.length > 0) {
      console.log(chalk.green('\n🏃 Active Jobs:'));
      activeJobs.forEach(job => {
        console.log(`   ${job.id}: ${job.name} (${job.progress}% complete)`);
        if (job.data) {
          console.log(`      Data: ${JSON.stringify(job.data).substring(0, 100)}...`);
        }
      });
    }

    // Failed jobs
    if (failedJobs.length > 0) {
      console.log(chalk.red('\n❌ Failed Jobs:'));
      failedJobs.forEach(job => {
        console.log(`   ${job.id}: ${job.name} - ${job.failedReason}`);
      });
    }
  }

  async startLiveMonitoring(interval = 5): Promise<void> {
    this.isRunning = true;
    console.log(chalk.yellow(`🔄 Starting live monitoring (${interval}s refresh, Ctrl+C to stop)...`));

    while (this.isRunning) {
      try {
        await this.displayStatus();
        await new Promise(resolve => setTimeout(resolve, interval * 1000));
      } catch (error) {
        console.error(chalk.red('Monitor error:'), error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  async cleanup(): Promise<void> {
    this.isRunning = false;
    await this.disconnect();
    console.log(chalk.yellow('\n👋 Queue monitor stopped'));
    process.exit(0);
  }
}

// CLI Commands
async function main() {
  const args = process.argv.slice(2);
  const monitor = new RedisQueueMonitor();

  // Handle graceful shutdown
  process.on('SIGINT', () => monitor.cleanup());
  process.on('SIGTERM', () => monitor.cleanup());

  try {
    await monitor.connect();

    if (args.includes('--live')) {
      const intervalIndex = args.indexOf('--interval');
      const interval = intervalIndex !== -1 && args[intervalIndex + 1] ? 
        parseInt(args[intervalIndex + 1]) : 5;
      
      await monitor.startLiveMonitoring(interval);
    } else if (args.includes('--queue')) {
      const queueIndex = args.indexOf('--queue');
      const queueName = queueIndex !== -1 && args[queueIndex + 1] ? 
        args[queueIndex + 1] : 'BulkCruiseProcessingQueue';
      
      await monitor.monitorSpecificQueue(queueName);
    } else {
      await monitor.displayStatus();
    }

  } catch (error) {
    console.error(chalk.red('❌ Monitor failed:'), error);
    process.exit(1);
  } finally {
    await monitor.cleanup();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { RedisQueueMonitor };