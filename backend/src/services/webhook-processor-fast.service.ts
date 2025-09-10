import * as ftp from 'basic-ftp';
import { db } from '../db/connection';
import { cruises } from '../db/schema/cruises';
import { eq } from 'drizzle-orm';
import logger from '../config/logger';
import * as fs from 'fs/promises';

export class WebhookProcessorFast {
  private stats = {
    filesProcessed: 0,
    cruisesUpdated: 0,
    errors: [] as string[],
  };

  async processWebhooks(lineId: number): Promise<void> {
    const startTime = Date.now();
    console.log(`[FAST] Starting webhook processing for line ${lineId}`);

    try {
      // Only check current month
      const files = await this.discoverCurrentMonthFiles(lineId);
      console.log(`[FAST] Found ${files.length} files to process`);

      // Process only first 5 files to avoid timeout
      const filesToProcess = files.slice(0, 5);
      console.log(`[FAST] Processing ${filesToProcess.length} files`);

      for (const file of filesToProcess) {
        await this.processFile(file);
      }

      const duration = Date.now() - startTime;
      console.log(`[FAST] Completed in ${duration}ms - Processed: ${this.stats.filesProcessed}, Updated: ${this.stats.cruisesUpdated}`);
    } catch (error) {
      console.error('[FAST] Processing failed:', error);
      throw error;
    }
  }

  private async discoverCurrentMonthFiles(lineId: number): Promise<any[]> {
    const client = new ftp.Client();
    client.ftp.verbose = false;
    const files: any[] = [];

    try {
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
        secure: false,
        timeout: 10000, // Shorter timeout
      };

      await client.access(ftpConfig);

      // Only check current month
      const now = new Date();
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const linePath = `/${year}/${month}/${lineId}`;

      console.log(`[FAST] Checking ${linePath}`);

      try {
        const shipDirs = await client.list(linePath);

        for (const shipDir of shipDirs) {
          if (shipDir.type === 2) { // Directory
            const shipPath = `${linePath}/${shipDir.name}`;
            const cruiseFiles = await client.list(shipPath);

            for (const file of cruiseFiles) {
              if (file.type === 1 && file.name.endsWith('.json')) {
                files.push({
                  path: `${shipPath}/${file.name}`,
                  name: file.name,
                  lineId: lineId,
                  shipId: parseInt(shipDir.name) || 0,
                  cruiseId: file.name.replace('.json', ''),
                });

                // Stop if we have enough files
                if (files.length >= 10) break;
              }
            }
            if (files.length >= 10) break;
          }
        }
      } catch (error) {
        console.log(`[FAST] No data for ${linePath}`);
      }
    } finally {
      client.close();
    }

    return files;
  }

  private async processFile(file: any): Promise<void> {
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
      const ftpConfig = {
        host: process.env.TRAVELTEK_FTP_HOST || 'ftpeu1prod.traveltek.net',
        user: process.env.TRAVELTEK_FTP_USER || process.env.FTP_USER,
        password: process.env.TRAVELTEK_FTP_PASSWORD || process.env.FTP_PASSWORD,
        secure: false,
        timeout: 10000,
      };

      await client.access(ftpConfig);

      // Download file
      const tempFile = `/tmp/webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.json`;
      await client.downloadTo(tempFile, file.path);

      // Read and parse JSON
      const content = await fs.readFile(tempFile, 'utf-8');
      const data = JSON.parse(content);

      // Update cruise in database
      if (data && data.id) {
        // Extract sailing date
        let sailingDate = data.embarkDate || data.embarkdate || data.sailingdate || data.sailing_date;
        if (sailingDate && sailingDate.includes('T')) {
          sailingDate = sailingDate.split('T')[0];
        }

        // Upsert cruise
        await db
          .insert(cruises)
          .values({
            id: data.id || file.cruiseId,
            cruiseId: data.cruiseid || data.cruise_id,
            name: data.name || data.title || 'Unknown Cruise',
            cruiseLineId: file.lineId,
            shipId: file.shipId || data.shipid || 0,
            nights: parseInt(data.nights) || 0,
            sailingDate: sailingDate || new Date().toISOString().split('T')[0],
            embarkPortId: data.embarkportid || 0,
            disembarkPortId: data.disembarkportid || 0,
            rawData: data,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: cruises.id,
            set: {
              name: data.name || data.title,
              nights: parseInt(data.nights) || 0,
              sailingDate: sailingDate,
              rawData: data,
              updatedAt: new Date(),
            },
          });

        this.stats.cruisesUpdated++;
        console.log(`[FAST] Updated cruise ${data.id}`);

        // Store pricing if available
        if (data.prices || data.pricing || data.cabins) {
          await this.updatePricing(data.id || file.cruiseId, data);
        }
      }

      this.stats.filesProcessed++;

      // Clean up
      await fs.unlink(tempFile).catch(() => {});
    } catch (error) {
      console.error(`[FAST] Failed to process ${file.path}:`, error);
      this.stats.errors.push(`${file.path}: ${error}`);
    } finally {
      client.close();
    }
  }

  private async updatePricing(cruiseId: string, data: any): Promise<void> {
    try {
      // Check if we have pricing data
      const pricingData = data.prices || data.pricing || data.cabins;
      if (!pricingData) return;

      // Get the cruise to ensure it exists
      const cruise = await db
        .select()
        .from(cruises)
        .where(eq(cruises.id, cruiseId))
        .limit(1);

      if (cruise.length === 0) {
        console.log(`[FAST] Cruise ${cruiseId} not found for pricing update`);
        return;
      }

      // Extract cheapest prices by category
      let interiorPrice = null;
      let oceanviewPrice = null;
      let balconyPrice = null;
      let suitePrice = null;

      // Process pricing data (structure depends on Traveltek format)
      if (Array.isArray(pricingData)) {
        for (const cabin of pricingData) {
          const price = parseFloat(cabin.price || cabin.adult_price || cabin.adultprice || 0);
          const category = (cabin.category || cabin.cabin_type || '').toLowerCase();

          if (category.includes('interior') && (!interiorPrice || price < interiorPrice)) {
            interiorPrice = price;
          } else if (category.includes('ocean') && (!oceanviewPrice || price < oceanviewPrice)) {
            oceanviewPrice = price;
          } else if (category.includes('balcony') && (!balconyPrice || price < balconyPrice)) {
            balconyPrice = price;
          } else if (category.includes('suite') && (!suitePrice || price < suitePrice)) {
            suitePrice = price;
          }
        }
      }

      // Update cruise with pricing
      if (interiorPrice || oceanviewPrice || balconyPrice || suitePrice) {
        await db
          .update(cruises)
          .set({
            interiorPrice: interiorPrice?.toString(),
            oceanviewPrice: oceanviewPrice?.toString(),
            balconyPrice: balconyPrice?.toString(),
            suitePrice: suitePrice?.toString(),
            updatedAt: new Date(),
          })
          .where(eq(cruises.id, cruiseId));

        console.log(`[FAST] Updated pricing for cruise ${cruiseId}`);
      }
    } catch (error) {
      console.error(`[FAST] Failed to update pricing for ${cruiseId}:`, error);
    }
  }
}
