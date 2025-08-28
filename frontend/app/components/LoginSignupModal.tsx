'use client';

import { useState } from 'react';
import { useSignIn, useSignUp } from '../hooks/useClerkHooks';

interface LoginSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginSignupModal({ isOpen, onClose, onSuccess }: LoginSignupModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  if (!isOpen) return null;

  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleEmailAuth = async () => {
    if (!email) {
      setMessage('Please enter your email address');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      // Try to sign in first
      const signInResult = await signIn?.create({
        identifier: email,
        redirectUrl: window.location.href,
      });

      if (signInResult?.status === 'complete') {
        setMessage('Sign in successful!');
        onSuccess();
        return;
      }

      // If sign in doesn't work, try sign up
      const signUpResult = await signUp?.create({
        emailAddress: email,
      });

      if (signUpResult?.status === 'missing_requirements') {
        setMessage('Check your email for a magic link to continue!');
      }
    } catch (error: any) {
      console.error('Email auth error:', error);
      setMessage('Error: ' + (error.message || 'Something went wrong'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    try {
      await signIn?.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/auth/callback',
        redirectUrlComplete: window.location.href,
      });
    } catch (error: any) {
      console.error('Google auth error:', error);
      setMessage('Error with Google sign in: ' + (error.message || 'Something went wrong'));
      setIsLoading(false);
    }
  };

  const handleFacebookAuth = async () => {
    setIsLoading(true);
    try {
      await signIn?.authenticateWithRedirect({
        strategy: 'oauth_facebook',
        redirectUrl: '/auth/callback',
        redirectUrlComplete: window.location.href,
      });
    } catch (error: any) {
      console.error('Facebook auth error:', error);
      setMessage('Error with Facebook sign in: ' + (error.message || 'Something went wrong'));
      setIsLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
      onClick={handleBackgroundClick}
    >
      <div 
        className="bg-white w-full max-w-[530px] rounded-[10px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 text-center">
          {/* Header */}
          <div className="mb-6">
            <h2 className="font-whitney font-black text-[32px] text-dark-blue uppercase" style={{ letterSpacing: '-0.02em' }}>
              SIGN UP / LOG IN
            </h2>
            <p className="font-geograph text-[18px] text-[#2f2f2f] leading-[1.5] mt-2" style={{ letterSpacing: '-0.02em' }}>
              We'll email you as soon as your quote is ready
            </p>
          </div>

          {/* Email Input */}
          <div className="mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              className="w-full border border-[#d9d9d9] rounded-[10px] p-4 font-geograph text-[16px] text-center"
              disabled={isLoading}
            />
          </div>

          {/* Message Display */}
          {message && (
            <div className={`mb-6 p-3 rounded-lg text-sm ${
              message.includes('Error') || message.includes('error')
                ? 'bg-red-50 text-red-600'
                : 'bg-green-50 text-green-600'
            }`}>
              {message}
            </div>
          )}

          {/* Email Submit Button */}
          <button
            onClick={handleEmailAuth}
            disabled={isLoading}
            className="w-full bg-[#2f7ddd] text-white font-geograph font-medium text-[16px] px-6 py-4 rounded-full hover:bg-[#2f7ddd]/90 transition-colors mb-6 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : 'Sign up / Log in'}
          </button>

          {/* Separator */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-geograph">or</span>
            </div>
          </div>

          {/* Social Login Buttons */}
          <div className="space-y-4">
            {/* Google Button */}
            <button
              onClick={handleGoogleAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-full py-4 px-6 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <img src="/images/google-icon.svg" alt="Google" className="w-5 h-5" />
              <span className="font-geograph font-medium text-[16px] text-gray-700">
                Continue with Google
              </span>
            </button>

            {/* Facebook Button */}
            <button
              onClick={handleFacebookAuth}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-full py-4 px-6 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <img src="/images/facebook-icon.svg" alt="Facebook" className="w-5 h-5" />
              <span className="font-geograph font-medium text-[16px] text-gray-700">
                Continue with Facebook
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}