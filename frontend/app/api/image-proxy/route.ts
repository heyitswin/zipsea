import { NextRequest, NextResponse } from "next/server";

// Simple in-memory rate limiter
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // requests per minute per IP
const RATE_WINDOW = 60000; // 1 minute in ms

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts.entries()) {
    if (now > record.resetTime) {
      requestCounts.delete(ip);
    }
  }
}, RATE_WINDOW);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

  // Rate limiting
  const clientIp =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";

  if (!checkRateLimit(clientIp)) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!imageUrl) {
    return NextResponse.json(
      { error: "No image URL provided" },
      { status: 400 },
    );
  }

  // Validate that the image URL is from allowed domains
  const allowedDomains = [
    "traveltek.net", // Allow all traveltek.net subdomains including static.traveltek.net
    "images.unsplash.com",
    "source.unsplash.com",
    "localhost",
  ];

  try {
    const url = new URL(imageUrl);
    if (!allowedDomains.some((domain) => url.hostname.includes(domain))) {
      console.warn(`Image proxy: domain not allowed: ${url.hostname}`);
      return NextResponse.json(
        { error: "Domain not allowed" },
        { status: 403 },
      );
    }
  } catch (e) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZipSea/1.0)",
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "no-cache",
        Referer: "https://zipsea.com/",
      },
      signal: controller.signal,
      // Additional fetch options for reliability
      redirect: "follow",
      keepalive: false,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(
        `Image proxy failed for ${imageUrl}: ${response.status} ${response.statusText}`,
      );
      return NextResponse.json(
        { error: "Failed to fetch image", status: response.status },
        { status: response.status },
      );
    }

    const contentType = response.headers.get("content-type") || "image/jpeg";
    const contentLength = response.headers.get("content-length");

    // Check if image is too large (limit to 10MB)
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      console.warn(`Image too large: ${imageUrl} (${contentLength} bytes)`);
      return NextResponse.json(
        { error: "Image too large (max 10MB)" },
        { status: 413 },
      );
    }

    // IMPORTANT: Stream the response instead of buffering
    // This prevents memory exhaustion with large images
    if (!response.body) {
      return NextResponse.json({ error: "No response body" }, { status: 500 });
    }

    // Create a new Response with the streamed body
    // This passes the ReadableStream directly without buffering
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        ...(contentLength && { "Content-Length": contentLength }),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-Cache": "STREAM",
      },
    });
  } catch (error) {
    console.error("Image proxy error:", error);

    // Handle specific error types with proper type checking
    const errorObj = error as Error & { name?: string; code?: string };

    if (errorObj.name === "AbortError") {
      return NextResponse.json(
        { error: "Image request timeout" },
        { status: 408 },
      );
    }

    if (errorObj.code === "ECONNREFUSED" || errorObj.code === "ENOTFOUND") {
      return NextResponse.json(
        { error: "Image source unavailable" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to proxy image",
        details:
          process.env.NODE_ENV === "development" ? errorObj.message : undefined,
      },
      { status: 500 },
    );
  }
}
