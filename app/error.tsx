"use client";

import { useEffect } from 'react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Global Error Boundary caught an error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh bg-black text-white p-4 text-center">
      <div className="max-w-md bg-[#18181B] border border-[#27272A] rounded-xl p-8 shadow-lg">
        <h2 className="text-2xl font-bold text-[#EA580C] mb-4 font-space-grotesk">
          Oops, this part of CogniBase hit a snag.
        </h2>
        <p className="text-[#A1A1AA] mb-6">
          We encountered an unexpected error while loading this page. Our systems have been notified.
        </p>
        <button
          onClick={() => reset()}
          className="bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-md"
        >
          Refresh Page
        </button>
      </div>
    </div>
  );
}
