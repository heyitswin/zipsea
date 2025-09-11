import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/cruises",
  "/cruise/(.*)",
  "/sign-in",
  "/sign-up",
  "/terms",
  "/privacy",
  "/why-zipsea",
  "/faqs",
  "/api/send-quote-confirmation",
  "/api/test-email",
  "/api/test-config",
  "/api/image-proxy", // Allow public access to image proxy
  // Public API routes for cruise browsing
  "/api/v1/cruises/(.*)",
  "/api/v1/search",
  "/api/v1/ships/(.*)",
  "/api/health",
]);

// Define admin routes that require admin role
const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // Check if user is trying to access admin routes
  if (isAdminRoute(req)) {
    // If not logged in, redirect to sign-in
    if (!userId) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }

    // Check if user has admin role
    // Note: This requires setting publicMetadata.role = 'admin' in Clerk Dashboard
    // AND configuring the session token to include publicMetadata
    const userRole = (sessionClaims as any)?.publicMetadata?.role;
    const isAdmin = userRole === "admin";

    if (!isAdmin) {
      // Redirect non-admin users to homepage with an error message
      const homeUrl = new URL("/", req.url);
      homeUrl.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(homeUrl);
    }
  }

  // For protected routes (not public), ensure user is authenticated
  if (!isPublicRoute(req) && !userId) {
    const signInUrl = new URL("/sign-in", req.url);
    signInUrl.searchParams.set("redirect_url", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Handle post-authentication redirects
  if (
    req.nextUrl.pathname === "/" &&
    req.nextUrl.searchParams.get("__clerk_status") === "complete"
  ) {
    // Check if there's a stored redirect URL from sessionStorage
    // Since middleware runs server-side, we need to handle this client-side
    // This will be handled in the root page component instead
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
