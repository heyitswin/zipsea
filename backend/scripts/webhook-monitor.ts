#!/usr/bin/env tsx

/**
 * Real-time Webhook System Monitor
 * 
 * This script continuously monitors the webhook system and provides:
 * 1. Real-time status updates
 * 2. Queue health monitoring
 * 3. Processing performance tracking
 * 4. Alert notifications
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const API_BASE = process.env.API_BASE || 'https://zipsea-production.onrender.com/api';
const WEBHOOK_BASE = `${API_BASE}/webhooks`;

interface SystemHealth {
  timestamp: string;
  healthy: boolean;
  totalWebhooks: number;
  processedWebhooks: number;
  pendingWebhooks: number;
  averageProcessingTime: number;
  successfulCruises: number;
  failedCruises: number;
  successRate: number;
  processingRate: number;
}

interface MonitorConfig {
  interval: number; // seconds
  alertThresholds: {
    pendingWebhooks: number;
    averageProcessingTime: number; // ms
    successRate: number; // percentage
    maxConsecutiveFailures: number;
  };
  duration?: number; // seconds, undefined = infinite
}

class WebhookSystemMonitor {
  private config: MonitorConfig;
  private healthHistory: SystemHealth[] = [];
  private consecutiveFailures = 0;
  private monitoring = false;
  private startTime: number;

  constructor(config: MonitorConfig) {
    this.config = config;
    this.startTime = performance.now();
  }

  /**
   * Fetch current system health
   */
  async fetchSystemHealth(): Promise<SystemHealth | null> {
    try {
      const [healthResponse, statusResponse] = await Promise.all([
        axios.get(`${WEBHOOK_BASE}/traveltek/health`, { timeout: 10000 }),
        axios.get(`${WEBHOOK_BASE}/traveltek/status`, { timeout: 10000 })
      ]);

      const health = healthResponse.data;
      const status = statusResponse.data;
      const stats = status.summary;

      const successfulCruises = stats.successfulCruises || 0;
      const failedCruises = stats.failedCruises || 0;
      const totalCruises = successfulCruises + failedCruises;
      const successRate = totalCruises > 0 ? (successfulCruises / totalCruises) * 100 : 100;

      return {
        timestamp: new Date().toISOString(),
        healthy: health.status === 'healthy' && status.healthStatus?.healthy,
        totalWebhooks: stats.totalWebhooks || 0,
        processedWebhooks: stats.processedWebhooks || 0,
        pendingWebhooks: stats.pendingWebhooks || 0,
        averageProcessingTime: stats.averageProcessingTimeMs || 0,
        successfulCruises,
        failedCruises,
        successRate,
        processingRate: stats.processedWebhooks || 0
      };

    } catch (error) {
      console.error('❌ Failed to fetch system health:', error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  }

  /**
   * Check for alerts based on thresholds
   */
  checkAlerts(health: SystemHealth): string[] {
    const alerts: string[] = [];

    if (health.pendingWebhooks > this.config.alertThresholds.pendingWebhooks) {
      alerts.push(`🚨 HIGH PENDING QUEUE: ${health.pendingWebhooks} webhooks pending (threshold: ${this.config.alertThresholds.pendingWebhooks})`);
    }

    if (health.averageProcessingTime > this.config.alertThresholds.averageProcessingTime) {
      alerts.push(`🚨 SLOW PROCESSING: ${Math.round(health.averageProcessingTime)}ms average (threshold: ${this.config.alertThresholds.averageProcessingTime}ms)`);
    }

    if (health.successRate < this.config.alertThresholds.successRate) {
      alerts.push(`🚨 LOW SUCCESS RATE: ${health.successRate.toFixed(1)}% (threshold: ${this.config.alertThresholds.successRate}%)`);
    }

    if (!health.healthy) {
      alerts.push('🚨 SYSTEM UNHEALTHY: Health check failed');
    }

    return alerts;
  }

  /**
   * Display current status
   */
  displayStatus(health: SystemHealth, alerts: string[]): void {
    const runTime = Math.round((performance.now() - this.startTime) / 1000);
    
    // Clear screen and display header
    console.clear();
    console.log('🔍 REAL-TIME WEBHOOK SYSTEM MONITOR');
    console.log('=' + '='.repeat(50));
    console.log(`📅 ${health.timestamp}`);
    console.log(`⏱️  Monitor running for: ${runTime}s (checking every ${this.config.interval}s)`);
    console.log();

    // System status
    const statusIcon = health.healthy ? '🟢' : '🔴';
    console.log(`${statusIcon} SYSTEM STATUS: ${health.healthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    console.log();

    // Key metrics
    console.log('📊 KEY METRICS:');
    console.log(`  Total Webhooks: ${health.totalWebhooks}`);
    console.log(`  Processed: ${health.processedWebhooks}`);
    console.log(`  Pending: ${health.pendingWebhooks} ${health.pendingWebhooks > 10 ? '⚠️' : '✅'}`);
    console.log(`  Avg Processing Time: ${Math.round(health.averageProcessingTime)}ms ${health.averageProcessingTime > 30000 ? '⚠️' : '✅'}`);
    console.log();

    // Cruise processing results
    console.log('🚢 CRUISE PROCESSING (Real FTP Results):');
    console.log(`  Successful Updates: ${health.successfulCruises} ✅`);
    console.log(`  Failed Updates: ${health.failedCruises} ${health.failedCruises > 0 ? '❌' : '✅'}`);
    console.log(`  Success Rate: ${health.successRate.toFixed(1)}% ${health.successRate > 85 ? '✅' : '⚠️'}`);
    console.log();

    // Alerts
    if (alerts.length > 0) {
      console.log('🚨 ALERTS:');
      alerts.forEach(alert => console.log(`  ${alert}`));
      console.log();
    } else {
      console.log('✅ NO ALERTS - All systems operating normally');
      console.log();
    }

    // Performance trends (if we have history)
    if (this.healthHistory.length > 1) {
      const recent = this.healthHistory.slice(-5);
      const avgProcessingTrend = this.calculateTrend(recent.map(h => h.averageProcessingTime));
      const successRateTrend = this.calculateTrend(recent.map(h => h.successRate));
      
      console.log('📈 TRENDS (Last 5 checks):');
      console.log(`  Processing Time: ${avgProcessingTrend > 0 ? '📈' : avgProcessingTrend < 0 ? '📉' : '➡️'} ${avgProcessingTrend > 0 ? 'INCREASING' : avgProcessingTrend < 0 ? 'DECREASING' : 'STABLE'}`);
      console.log(`  Success Rate: ${successRateTrend > 0 ? '📈' : successRateTrend < 0 ? '📉' : '➡️'} ${successRateTrend > 0 ? 'IMPROVING' : successRateTrend < 0 ? 'DECLINING' : 'STABLE'}`);
      console.log();
    }

    // Real-time differences from old system
    console.log('🆚 NEW vs OLD SYSTEM:');
    console.log('  ❌ OLD: Set needs_price_update flags (deferred processing)');
    console.log('  ✅ NEW: Immediate FTP downloads with actual results');
    console.log('  ❌ OLD: Batch processing (slow, unreliable)');
    console.log('  ✅ NEW: Real-time parallel processing (10 workers)');
    console.log();

    // Instructions
    console.log('💡 MONITORING TIPS:');
    console.log('  - Watch Slack for detailed processing messages');
    console.log('  - Success Rate should stay above 85%');
    console.log('  - Pending webhooks should stay below 10');
    console.log('  - Press Ctrl+C to stop monitoring');
    console.log();
    
    console.log('='.repeat(52));
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;
    
    if (Math.abs(change) < 5) return 0; // Stable
    return change > 0 ? 1 : -1; // Increasing or decreasing
  }

  /**
   * Start monitoring
   */
  async startMonitoring(): Promise<void> {
    this.monitoring = true;
    console.log('🚀 Starting webhook system monitoring...');
    
    const checkInterval = setInterval(async () => {
      if (!this.monitoring) {
        clearInterval(checkInterval);
        return;
      }

      const health = await this.fetchSystemHealth();
      if (!health) {
        this.consecutiveFailures++;
        if (this.consecutiveFailures >= this.config.alertThresholds.maxConsecutiveFailures) {
          console.log(`🚨 CRITICAL: ${this.consecutiveFailures} consecutive monitoring failures!`);
        }
        return;
      }

      this.consecutiveFailures = 0;
      this.healthHistory.push(health);
      
      // Keep only last 100 entries to prevent memory issues
      if (this.healthHistory.length > 100) {
        this.healthHistory = this.healthHistory.slice(-100);
      }

      const alerts = this.checkAlerts(health);
      this.displayStatus(health, alerts);

      // Check if we should stop monitoring
      if (this.config.duration) {
        const runTime = (performance.now() - this.startTime) / 1000;
        if (runTime >= this.config.duration) {
          console.log(`\n⏰ Monitoring completed after ${this.config.duration} seconds`);
          this.stopMonitoring();
          clearInterval(checkInterval);
        }
      }

    }, this.config.interval * 1000);

    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      this.stopMonitoring();
      clearInterval(checkInterval);
      console.log('\n👋 Monitoring stopped by user');
      process.exit(0);
    });

    // Keep the process alive
    if (!this.config.duration) {
      console.log('Monitoring will run indefinitely. Press Ctrl+C to stop.');
    }
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    this.monitoring = false;
    
    if (this.healthHistory.length > 0) {
      console.log('\n📊 MONITORING SUMMARY:');
      console.log(`  Total checks: ${this.healthHistory.length}`);
      console.log(`  Average success rate: ${(this.healthHistory.reduce((sum, h) => sum + h.successRate, 0) / this.healthHistory.length).toFixed(1)}%`);
      console.log(`  Average processing time: ${Math.round(this.healthHistory.reduce((sum, h) => sum + h.averageProcessingTime, 0) / this.healthHistory.length)}ms`);
    }
  }

  /**
   * Run a single health check (non-monitoring mode)
   */
  async runHealthCheck(): Promise<void> {
    console.log('🔍 Running single health check...\n');
    
    const health = await this.fetchSystemHealth();
    if (!health) {
      console.log('❌ Health check failed - unable to fetch system status');
      return;
    }

    const alerts = this.checkAlerts(health);
    this.displayStatus(health, alerts);
    
    console.log('✅ Health check completed');
  }
}

// Predefined monitoring configurations
const MONITOR_CONFIGS = {
  default: {
    interval: 10,
    alertThresholds: {
      pendingWebhooks: 10,
      averageProcessingTime: 30000, // 30 seconds
      successRate: 85,
      maxConsecutiveFailures: 3
    }
  } as MonitorConfig,
  
  sensitive: {
    interval: 5,
    alertThresholds: {
      pendingWebhooks: 5,
      averageProcessingTime: 15000, // 15 seconds
      successRate: 90,
      maxConsecutiveFailures: 2
    }
  } as MonitorConfig,
  
  relaxed: {
    interval: 30,
    alertThresholds: {
      pendingWebhooks: 20,
      averageProcessingTime: 60000, // 60 seconds
      successRate: 75,
      maxConsecutiveFailures: 5
    }
  } as MonitorConfig
};

// Main execution
async function main() {
  const mode = process.argv[2] || 'monitor';
  const configType = process.argv[3] || 'default';
  const duration = process.argv[4] ? parseInt(process.argv[4]) : undefined;

  console.log('🔍 WEBHOOK SYSTEM MONITOR');
  console.log('========================');

  if (!MONITOR_CONFIGS[configType as keyof typeof MONITOR_CONFIGS]) {
    console.log('❌ Invalid config type. Available options: default, sensitive, relaxed');
    console.log('\nUsage: tsx webhook-monitor.ts [monitor|check] [default|sensitive|relaxed] [duration]');
    console.log('\nExamples:');
    console.log('  tsx webhook-monitor.ts monitor default     # Continuous monitoring');
    console.log('  tsx webhook-monitor.ts monitor sensitive 300  # Monitor for 5 minutes');
    console.log('  tsx webhook-monitor.ts check              # Single health check');
    return;
  }

  const config = { ...MONITOR_CONFIGS[configType as keyof typeof MONITOR_CONFIGS] };
  if (duration) {
    config.duration = duration;
  }

  const monitor = new WebhookSystemMonitor(config);

  try {
    if (mode === 'check') {
      await monitor.runHealthCheck();
    } else {
      await monitor.startMonitoring();
    }
  } catch (error) {
    console.error('💥 Monitoring failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { WebhookSystemMonitor, MONITOR_CONFIGS };