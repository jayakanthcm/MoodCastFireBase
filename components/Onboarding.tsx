import React, { useState } from 'react';
import { auth } from '../services/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  signInWithPopup
} from 'firebase/auth';
import { googleProvider } from '../services/firebase';

interface Props {
  onComplete: () => void;
  onSignupSuccess: (email: string) => void;
}

export const Onboarding: React.FC<Props> = ({ onComplete, onSignupSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isResetMode) {
        await sendPasswordResetEmail(auth, email);
        setResetSent(true);
        setLoading(false);
        return;
      }

      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
        // Success handled by App.tsx's onAuthStateChanged
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        await signOut(auth); // Sign out immediately so they have to login after verifying
        onSignupSuccess(email);
      }
    } catch (err: any) {
      console.error(err);
      let msg = "An error occurred";
      const errorCode = err.code;

      if (errorCode === 'auth/invalid-credential' ||
        errorCode === 'auth/user-not-found' ||
        errorCode === 'auth/wrong-password' ||
        errorCode === 'auth/invalid-email') {
        msg = "Email or password is incorrect";
      } else if (errorCode === 'auth/email-already-in-use') {
        msg = "User already exists. Please sign in";
      } else if (errorCode === 'auth/weak-password') {
        msg = "Password should be at least 6 characters";
      } else {
        msg = err.message || "Authentication failed";
      }
      setError(msg);
    } finally {
      if (!isResetMode) setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      // Success handled by App.tsx
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center w-full max-w-md mx-auto">
      <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-8 shadow-lg shadow-indigo-500/50 rotate-12">
        <span className="text-white text-4xl font-bold">A</span>
      </div>
      <h1 className="text-3xl font-bold mb-4 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
        {isResetMode ? 'Reset Password' : (isLogin ? 'Welcome Back' : 'Join Aura')}
      </h1>
      <p className="text-slate-400 mb-8">
        {isResetMode
          ? 'Enter your email to get back in.'
          : (isLogin ? 'Sign in to pulse your vibe.' : 'Create an account to connect.')}
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4 text-left">
        <div>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
            required
          />
        </div>
        {!isResetMode && (
          <div>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
              required
            />
            {isLogin && (
              <div className="flex justify-end mt-2">
                <button
                  type="button"
                  onClick={() => { setIsResetMode(true); setError(null); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="text-red-400 text-sm font-medium animate-pulse text-center">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full py-4 rounded-2xl font-semibold transition-all duration-300 mt-4 ${loading
            ? 'bg-slate-800 text-slate-500 cursor-wait'
            : 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20 active:scale-95 hover:bg-indigo-500'
            }`}
        >
          {loading ? 'Processing...' : (isResetMode ? 'Send Reset Link' : (isLogin ? 'Sign In' : 'Sign Up'))}
        </button>
      </form>

      {resetSent && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-8 z-50">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-6 animate-bounce">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-slate-400 mb-8 text-center">
            We've sent a password reset link to <br /> <span className="text-white font-medium">{email}</span>
          </p>
          <button
            onClick={() => { setIsResetMode(false); setResetSent(false); }}
            className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
          >
            Back to Login
          </button>
        </div>
      )}

      <div className="relative w-full py-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-slate-800"></span>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-slate-950 px-2 text-slate-500 font-medium">Or continue with</span>
        </div>
      </div>

      <button
        type="button"
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full py-4 rounded-2xl font-semibold bg-white text-slate-950 flex items-center justify-center gap-3 transition-all duration-300 hover:bg-slate-200 active:scale-95 shadow-xl"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Google
      </button>

      <div className="mt-8 flex gap-2 text-sm text-slate-400">
        <span>
          {isResetMode
            ? "Remember your password?"
            : (isLogin ? "Don't have an account?" : "Already have an account?")}
        </span>
        <button
          onClick={() => {
            if (isResetMode) {
              setIsResetMode(false);
            } else {
              setIsLogin(!isLogin);
            }
            setError(null);
          }}
          className="text-indigo-400 font-bold hover:text-indigo-300 transition-colors"
        >
          {isResetMode ? 'Sign In' : (isLogin ? 'Sign Up' : 'Sign In')}
        </button>
      </div>
    </div>
  );
};
