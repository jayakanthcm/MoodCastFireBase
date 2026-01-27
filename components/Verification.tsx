import React from 'react';

interface Props {
  email?: string | null;
  onGoToLogin: () => void;
}

export const Verification: React.FC<Props> = ({ email, onGoToLogin }) => {
  return (
    <div className="flex-1 flex flex-col p-8 items-center justify-center text-center">
      <div className="w-24 h-24 bg-indigo-600/20 rounded-full flex items-center justify-center mb-8 animate-pulse">
        <svg className="w-10 h-10 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold mb-4 text-white">Verify Your Email</h2>

      <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
        We have sent a verification email to <br />
        <span className="text-white font-bold">{email || 'your email address'}</span>.
        <br /><br />
        Please check your inbox, verify your account, and then log in to continue.
      </p>

      <button
        onClick={onGoToLogin}
        className="w-full max-w-xs py-4 bg-white text-slate-950 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95 shadow-xl"
      >
        Login
      </button>

      <p className="mt-8 text-xs text-slate-600 font-medium">
        Didn't receive it? Check your spam folder.
      </p>
    </div>
  );
};
