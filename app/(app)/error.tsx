'use client';

import { useEffect } from 'react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Uncaught app error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-[#09090B]">
      <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
      <p className="text-gray-400 max-w-sm mb-6">
        This wasn't supposed to happen. Try again, and if it keeps occurring, let us know what you were doing when it happened.
      </p>
      <button
        onClick={() => reset()}
        className="bg-orange-600 hover:bg-orange-500 text-white font-bold px-6 py-3 rounded-lg transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
