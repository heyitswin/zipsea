import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');
  
  if (!imageUrl) {
    return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
  }

  // Validate that the image URL is from allowed domains
  const allowedDomains = ['static.traveltek.net'];
  const url = new URL(imageUrl);
  
  if (!allowedDomains.includes(url.hostname)) {
    return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
  }

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'ZipSea Frontend/1.0',
        'Accept': 'image/*',
        'Accept-Encoding': 'identity', // Disable compression to avoid issues
        'Cache-Control': 'max-age=3600',
      },
      signal: controller.signal,
      // Additional fetch options for reliability
      redirect: 'follow',
      keepalive: false,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
        'X-Proxy-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    
    // Handle specific error types with proper type checking
    const errorObj = error as Error & { name?: string; code?: string };
    
    if (errorObj.name === 'AbortError') {
      return NextResponse.json({ error: 'Image request timeout' }, { status: 408 });
    }
    
    if (errorObj.code === 'ECONNREFUSED' || errorObj.code === 'ENOTFOUND') {
      return NextResponse.json({ error: 'Image source unavailable' }, { status: 502 });
    }
    
    return NextResponse.json({ 
      error: 'Failed to proxy image', 
      details: process.env.NODE_ENV === 'development' ? errorObj.message : undefined 
    }, { status: 500 });
  }
}