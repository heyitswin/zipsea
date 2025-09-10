import { db } from '../db/connection';
import { syncLocks } from '../db/schema/webhook-events';
import { eq } from 'drizzle-orm';
import { ftpConnectionPool } from './ftp-connection-pool.service';

export class WebhookProcessorCorrect {
  /**
   * Discover cruise files for a specific line
   * FTP structure: /year/month/lineid/shipid/codetocruiseid.json
   */
  async discoverCruiseFiles(lineId: number): Promise<{ success: boolean; files: any[]; error?: string }> {
    console.log(`[CORRECT] Starting discovery for line ${lineId}`);

    let conn;
    try {
      conn = await ftpConnectionPool.getConnection();
      console.log(`[CORRECT] Got FTP connection: ${conn.id}`);

      const files: any[] = [];
      const currentDate = new Date();
      const year = currentDate.getFullYear();

      // Check current and next month
      for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
        const checkDate = new Date(currentDate);
        checkDate.setMonth(checkDate.getMonth() + monthOffset);

        const checkYear = checkDate.getFullYear();
        const checkMonth = (checkDate.getMonth() + 1).toString().padStart(2, '0');
        const linePath = `/${checkYear}/${checkMonth}/${lineId}`;

        console.log(`[CORRECT] Checking path: ${linePath}`);

        try {
          // List ship directories for this line
          const shipDirs = await conn.client.list(linePath);
          console.log(`[CORRECT] Found ${shipDirs.length} ships in ${checkYear}/${checkMonth} for line ${lineId}`);

          // Sample first few ships
          for (const shipDir of shipDirs.slice(0, 3)) {
            if (shipDir.type === 2) { // Directory
              const shipPath = `${linePath}/${shipDir.name}`;

              try {
                const cruiseFiles = await conn.client.list(shipPath);
                const jsonFiles = cruiseFiles.filter(f => f.type === 1 && f.name.endsWith('.json'));

                console.log(`[CORRECT] Ship ${shipDir.name} has ${jsonFiles.length} cruise files`);

                // Get first few cruise files from this ship
                for (const file of jsonFiles.slice(0, 3)) {
                  files.push({
                    path: `${shipPath}/${file.name}`,
                    size: file.size,
                    lineId: lineId,
                    shipId: parseInt(shipDir.name),
                    cruiseId: file.name.replace('.json', ''),
                    year: checkYear,
                    month: checkMonth,
                  });
                }
              } catch (shipError) {
                console.log(`[CORRECT] Error reading ship ${shipDir.name}:`, shipError);
              }
            }
          }
        } catch (error) {
          console.log(`[CORRECT] No data at ${linePath}:`, error);
        }
      }

      console.log(`[CORRECT] Total files found: ${files.length}`);

      return {
        success: true,
        files: files
      };

    } catch (error) {
      console.error(`[CORRECT] Discovery error:`, error);
      return {
        success: false,
        files: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      if (conn) {
        ftpConnectionPool.releaseConnection(conn.id);
        console.log(`[CORRECT] Released FTP connection`);
      }
    }
  }

  /**
   * List available cruise lines in FTP
   */
  async listAvailableLines(): Promise<{ success: boolean; lines: number[]; error?: string }> {
    console.log(`[CORRECT] Listing available lines`);

    let conn;
    try {
      conn = await ftpConnectionPool.getConnection();

      const availableLines = new Set<number>();
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const monthPath = `/${year}/${month}`;

      console.log(`[CORRECT] Checking ${monthPath}`);

      // List all directories in current month
      const lineDirs = await conn.client.list(monthPath);

      for (const dir of lineDirs) {
        if (dir.type === 2 && /^\d+$/.test(dir.name)) {
          availableLines.add(parseInt(dir.name));
        }
      }

      const sortedLines = Array.from(availableLines).sort((a, b) => a - b);
      console.log(`[CORRECT] Found ${sortedLines.length} lines with data`);

      return {
        success: true,
        lines: sortedLines
      };

    } catch (error) {
      console.error(`[CORRECT] List error:`, error);
      return {
        success: false,
        lines: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      if (conn) {
        ftpConnectionPool.releaseConnection(conn.id);
      }
    }
  }
}
