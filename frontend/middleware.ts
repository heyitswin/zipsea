import { authMiddleware } from '@clerk/nextjs';
import { NextResponse } from 'next/server';

export default authMiddleware({
  publicRoutes: [
    '/',
    '/cruise/(.*)',
    '/sign-in',
    '/sign-up',
    '/api/send-quote-confirmation',
    '/api/test-email',
    '/api/test-config',
  ],
  afterAuth(auth, req) {
    // Check if user is trying to access admin routes
    if (req.nextUrl.pathname.startsWith('/admin')) {
      // If not logged in, redirect to sign-in
      if (!auth.userId) {
        const signInUrl = new URL('/sign-in', req.url);
        signInUrl.searchParams.set('redirect_url', req.url);
        return NextResponse.redirect(signInUrl);
      }
      
      // Check if user has admin role
      // Note: This requires setting publicMetadata.role = 'admin' in Clerk Dashboard
      const isAdmin = auth.sessionClaims?.publicMetadata?.role === 'admin';
      
      if (!isAdmin) {
        // Redirect non-admin users to homepage with an error message
        const homeUrl = new URL('/', req.url);
        homeUrl.searchParams.set('error', 'unauthorized');
        return NextResponse.redirect(homeUrl);
      }
    }
    
    // Handle post-authentication redirects
    if (req.nextUrl.pathname === '/' && req.nextUrl.searchParams.get('__clerk_status') === 'complete') {
      // Check if there's a stored redirect URL from sessionStorage
      // Since middleware runs server-side, we need to handle this client-side
      // This will be handled in the root page component instead
    }
    
    return NextResponse.next();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}