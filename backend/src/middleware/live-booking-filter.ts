import { Request, Response, NextFunction } from 'express';
import { env } from '../config/environment';

/**
 * Middleware to filter searches to only live-bookable cruise lines when requested
 *
 * When instantBooking=true query parameter is set, this middleware:
 * 1. Adds cruise line filter to search requests
 * 2. Only shows Royal Caribbean (22), Celebrity (3), and Carnival (8)
 * 3. Improves performance by reducing the search space
 *
 * When instantBooking=false or not set:
 * - Does nothing - shows all cruise lines
 *
 * Note: instantBooking filter is OFF by default
 */
export function liveBookingFilter(req: Request, res: Response, next: NextFunction): void {
  // Only apply filter if instant booking is explicitly requested
  // The filter is OFF by default - user must toggle it ON
  if (req.query.instantBooking !== 'true') {
    return next();
  }

  // Check if live booking is enabled in environment
  if (!env.TRAVELTEK_LIVE_BOOKING_ENABLED) {
    // If not enabled, show all cruises even if filter is toggled
    return next();
  }

  // Parse the allowed cruise line IDs from env
  if (!env.TRAVELTEK_LIVE_BOOKING_LINE_IDS) {
    console.warn(
      '[LiveBookingFilter] TRAVELTEK_LIVE_BOOKING_LINE_IDS not configured, skipping filter'
    );
    return next();
  }

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
    // Check both cruiseLine and cruiseLineId parameter names
    const existingFilter = req.query.cruiseLine || req.query.cruiseLineId;

    if (existingFilter) {
      // If cruise line filter already exists, intersect with allowed IDs
      const requestedLines = Array.isArray(existingFilter)
        ? existingFilter.map(Number)
        : [Number(existingFilter)];

      const filteredLines = requestedLines.filter(id => allowedLineIds.includes(id));

      if (filteredLines.length === 0) {
        // User requested cruise lines that aren't available for live booking
        req.query.cruiseLineId = allowedLineIds.map(String);
        req.query.cruiseLine = allowedLineIds.map(String);
      } else {
        req.query.cruiseLineId = filteredLines.map(String);
        req.query.cruiseLine = filteredLines.map(String);
      }
    } else {
      // No cruise line filter specified, add it to both parameter names
      req.query.cruiseLineId = allowedLineIds.map(String);
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
