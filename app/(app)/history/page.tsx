// app/(app)/history/page.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { BookMarked, AlertCircle, Loader2 } from 'lucide-react';

interface ContentGeneration {
  id: string;
  createdAt: string;
  promptText: string;
  audience?: string | null;
  mediaType?: string | null;
  generatedBodyHtml?: string | null;
  justification?: string | null;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<ContentGeneration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/content-history');
        if (!response.ok) {
          throw new Error('Failed to fetch history');
        }
        const data = await response.json();
        setHistory(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <BookMarked className="mr-3 h-8 w-8 text-indigo-500" />
          Content Generation History
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Review your previously generated and saved content.
        </p>

        {isLoading && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            <p className="ml-3 text-lg text-gray-600 dark:text-gray-300">Loading history...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center">
            <AlertCircle className="inline mr-2 h-5 w-5"/>
            Error: {error}
          </div>
        )}

        {!isLoading && !error && history.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">You have no saved content history yet.</p>
          </div>
        )}

        {!isLoading && !error && history.length > 0 && (
          <div className="space-y-6">
            {history.map((item) => (
              <div key={item.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-grow">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">Prompt:</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 italic">&quot;{item.promptText}&quot;</p>
                    <div className="mt-2 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span><strong>Audience:</strong> {item.audience || 'N/A'}</span>
                      <span><strong>Media Type:</strong> {item.mediaType || 'N/A'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 ml-4">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
                {item.justification && (
                    <details className="mt-3 text-xs">
                        <summary className="cursor-pointer font-medium text-indigo-600 dark:text-indigo-400">View Justification</summary>
                        <p className="mt-1 p-2 bg-slate-50 dark:bg-slate-700 rounded text-gray-600 dark:text-gray-300">{item.justification}</p>
                    </details>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none mt-4 p-3 border-t border-gray-200 dark:border-gray-600">
                  <div dangerouslySetInnerHTML={{ __html: item.generatedBodyHtml || '' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}