import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment';

/**
 * Middleware to automatically filter searches to only live-bookable cruise lines
 *
 * When TRAVELTEK_LIVE_BOOKING_ENABLED is true, this middleware:
 * 1. Adds cruise line filter to all search requests
 * 2. Only shows Royal Caribbean (22) and Celebrity (3)
 * 3. Improves performance by reducing the search space
 *
 * This ensures users only see cruises they can actually book live.
 */
export function liveBookingFilter(req: Request, res: Response, next: NextFunction): void {
  // Only apply filter if live booking is enabled
  if (!env.TRAVELTEK_LIVE_BOOKING_ENABLED) {
    return next();
  }

  // Parse the allowed cruise line IDs from env
  const allowedLineIds = env.TRAVELTEK_LIVE_BOOKING_LINE_IDS.split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id));

  if (allowedLineIds.length === 0) {
    console.warn('[LiveBookingFilter] No valid cruise line IDs configured, skipping filter');
    return next();
  }

  // Apply filter based on request method
  if (req.method === 'GET') {
    // For GET requests, filter query params
    if (req.query.cruiseLine) {
      // If cruise line filter already exists, intersect with allowed IDs
      const requestedLines = Array.isArray(req.query.cruiseLine)
        ? req.query.cruiseLine.map(Number)
        : [Number(req.query.cruiseLine)];

      const filteredLines = requestedLines.filter(id => allowedLineIds.includes(id));

      if (filteredLines.length === 0) {
        // User requested cruise lines that aren't available for live booking
        req.query.cruiseLine = allowedLineIds.map(String);
      } else {
        req.query.cruiseLine = filteredLines.map(String);
      }
    } else {
      // No cruise line filter specified, add it
      req.query.cruiseLine = allowedLineIds.map(String);
    }
  } else if (req.method === 'POST') {
    // For POST requests, filter body params
    if (!req.body) {
      req.body = {};
    }

    if (req.body.cruiseLine || req.body.cruiseLineId) {
      // If cruise line filter already exists, intersect with allowed IDs
      const requestedLines = Array.isArray(req.body.cruiseLine || req.body.cruiseLineId)
        ? (req.body.cruiseLine || req.body.cruiseLineId).map(Number)
        : [Number(req.body.cruiseLine || req.body.cruiseLineId)];

      const filteredLines = requestedLines.filter(id => allowedLineIds.includes(id));

      if (filteredLines.length === 0) {
        // User requested cruise lines that aren't available for live booking
        req.body.cruiseLine = allowedLineIds;
        req.body.cruiseLineId = allowedLineIds[0]; // For services expecting single ID
      } else {
        req.body.cruiseLine = filteredLines;
        req.body.cruiseLineId = filteredLines[0]; // For services expecting single ID
      }
    } else {
      // No cruise line filter specified, add it
      req.body.cruiseLine = allowedLineIds;
      req.body.cruiseLineId = allowedLineIds[0]; // For services expecting single ID
    }
  }

  console.log(`[LiveBookingFilter] Applied filter - cruise lines: ${allowedLineIds.join(', ')}`);
  console.log(
    `[LiveBookingFilter] Method: ${req.method}, Query cruiseLine: ${req.query.cruiseLine}, Body cruiseLine: ${req.body?.cruiseLine}`
  );
  next();
}
