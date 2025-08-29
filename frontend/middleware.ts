import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function middleware(request: NextRequest) {
  // Handle post-authentication redirects
  if (request.nextUrl.pathname === '/' && request.nextUrl.searchParams.get('__clerk_status') === 'complete') {
    // Check if there's a stored redirect URL from sessionStorage
    // Since middleware runs server-side, we need to handle this client-side
    // This will be handled in the root page component instead
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}