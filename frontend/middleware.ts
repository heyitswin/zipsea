import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple pass-through middleware when Clerk is not configured
export default function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}