import { SignIn, SignUp, UserButton, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs';

export default function TestClerkPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Clerk Native Components Test</h1>
        
        {/* Test 1: User Button (shows when signed in) */}
        <div className="mb-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">User Status:</h2>
          <SignedIn>
            <div className="flex items-center gap-4">
              <p>You are signed in!</p>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <p>You are signed out</p>
          </SignedOut>
        </div>

        {/* Test 2: Sign In Button (native) */}
        <div className="mb-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Native Sign In Button:</h2>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Sign In with Native Clerk
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <p className="text-green-600">Already signed in!</p>
          </SignedIn>
        </div>

        {/* Test 3: Inline Sign In Component */}
        <div className="mb-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Inline Sign In Component:</h2>
          <SignedOut>
            <SignIn routing="hash" />
          </SignedOut>
        </div>

        {/* Debug Info */}
        <div className="mb-8 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h2 className="text-xl font-semibold mb-4">Debug Info:</h2>
          <p>Page URL: /test-clerk</p>
          <p>This page tests Clerk's native components</p>
          <p>If these work, we know Clerk is configured correctly</p>
        </div>
      </div>
    </div>
  );
}