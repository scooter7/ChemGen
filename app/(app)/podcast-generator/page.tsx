// app/(app)/podcast-generator/page.tsx
"use client";

import React, { useState } from 'react';
import { Mic, Link as LinkIcon, Loader2, AlertCircle, Download, BookText } from 'lucide-react';

type Stage = 'idle' | 'scraping' | 'scripting' | 'generating_audio' | 'done';

export default function PodcastGeneratorPage() {
    const [sourceText, setSourceText] = useState('');
    const [urlInput, setUrlInput] = useState('');
    const [hostMode, setHostMode] = useState<'single' | 'co-host'>('single');
    const [generatedScript, setGeneratedScript] = useState('');
    const [generatedPodcastUrl, setGeneratedPodcastUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [stage, setStage] = useState<Stage>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleScrapeUrl = async () => {
        if (!urlInput) {
            setError('Please enter a URL.');
            return;
        }
        setIsLoading(true);
        setStage('scraping');
        setError(null);
        try {
            const response = await fetch('/api/scrape-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: urlInput }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to scrape URL.');
            setSourceText(result.text);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
            setStage('idle');
        }
    };

    const handleGeneratePodcast = async () => {
        if (!sourceText) {
            setError('Please provide source text or scrape a URL first.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedScript('');
        setGeneratedPodcastUrl('');

        try {
            // 1. Generate Script
            setStage('scripting');
            const scriptResponse = await fetch('/api/generate-podcast-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: sourceText, hostMode }),
            });
            const scriptResult = await scriptResponse.json();
            if (!scriptResponse.ok) throw new Error(scriptResult.message || 'Failed to generate script.');
            setGeneratedScript(scriptResult.script);

            // 2. Generate Audio
            setStage('generating_audio');
            const audioResponse = await fetch('/api/generate-podcast-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: scriptResult.script }),
            });
            const audioResult = await audioResponse.json();
            if (!audioResponse.ok) throw new Error(audioResult.error || 'Failed to generate audio.');
            setGeneratedPodcastUrl(audioResult.podcastUrl);
            setStage('done');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            setStage('idle');
        } finally {
            setIsLoading(false);
        }
    };

    const getLoadingMessage = () => {
        switch(stage) {
            case 'scraping': return 'Scraping URL...';
            case 'scripting': return 'Generating script...';
            case 'generating_audio': return 'Generating audio, this may take a moment...';
            default: return 'Loading...';
        }
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                    <Mic className="mr-3 h-8 w-8 text-indigo-500" />
                    Podcast Generator
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                    Paste text or scrape a URL to transform content into a podcast.
                </p>

                <div className="space-y-6">
                    <div>
                        <label htmlFor="urlInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Scrape Content from URL
                        </label>
                        <div className="mt-1 flex rounded-md shadow-sm">
                            <input
                                type="url"
                                name="urlInput"
                                id="urlInput"
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                                className="block w-full rounded-none rounded-l-md border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-700"
                                placeholder="https://example.com"
                            />
                            <button
                                type="button"
                                onClick={handleScrapeUrl}
                                disabled={isLoading}
                                className="inline-flex items-center rounded-r-md border border-l-0 border-gray-300 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                            >
                                <LinkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                    
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center">
                            <span className="bg-white dark:bg-gray-800 px-2 text-sm text-gray-500 dark:text-gray-400">OR</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="sourceText" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Paste Text Content
                        </label>
                        <textarea
                            id="sourceText"
                            name="sourceText"
                            rows={8}
                            value={sourceText}
                            onChange={(e) => setSourceText(e.target.value)}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700"
                            placeholder="Paste your article or text here..."
                        />
                    </div>
                    
                    <div>
                         <label htmlFor="hostMode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Host Mode</label>
                        <select id="hostMode" name="hostMode" value={hostMode} onChange={(e) => setHostMode(e.target.value as 'single' | 'co-host')} className="mt-1 block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm dark:border-gray-600 dark:bg-gray-700">
                            <option value="single">Single Host</option>
                            <option value="co-host">Co-host (Conversational)</option>
                        </select>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={handleGeneratePodcast}
                            disabled={isLoading || !sourceText}
                            className="px-8 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center min-w-[150px]"
                        >
                            {isLoading ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />{getLoadingMessage()}</> : 'Generate Podcast'}
                        </button>
                    </div>
                </div>
            </div>

            {error && <div className="p-4 mt-6 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center"><AlertCircle className="inline mr-2 h-5 w-5"/>Error: {error}</div>}

            {generatedScript && (
                 <div className="mt-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                     <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center"><BookText className="mr-3 h-6 w-6 text-green-500"/>Generated Script</h2>
                     <pre className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 p-4 rounded-md whitespace-pre-wrap max-h-96 overflow-y-auto custom-scrollbar">{generatedScript}</pre>
                 </div>
            )}
            
            {generatedPodcastUrl && (
                <div className="mt-6 bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Generated Podcast</h2>
                    <audio controls src={generatedPodcastUrl} className="w-full">
                        Your browser does not support the audio element.
                    </audio>
                    <a href={generatedPodcastUrl} download="podcast.mp3" className="mt-4 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700">
                        <Download className="mr-2 h-5 w-5"/> Download Podcast
                    </a>
                </div>
            )}
        </div>
    );
}