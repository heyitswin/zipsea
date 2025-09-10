import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get("url");

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
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

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

    // Handle the response body properly
    let imageBuffer: ArrayBuffer;
    try {
      imageBuffer = await response.arrayBuffer();
    } catch (bufferError) {
      console.error(
        `Failed to read image buffer for ${imageUrl}:`,
        bufferError,
      );
      return NextResponse.json(
        { error: "Failed to read image data" },
        { status: 500 },
      );
    }

    // Validate we got actual image data
    if (!imageBuffer || imageBuffer.byteLength === 0) {
      console.error(`Empty image buffer for ${imageUrl}`);
      return NextResponse.json({ error: "Empty image data" }, { status: 500 });
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": imageBuffer.byteLength.toString(),
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Proxy-Cache": "MISS",
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
