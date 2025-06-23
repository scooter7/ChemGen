// app/(app)/video-generator/page.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react';
import { Video, Film, Loader2, AlertCircle, Image as ImageIconLucide, CheckCircle } from 'lucide-react';
import NextImage from 'next/image';

interface VideoFormState {
  prompt: string;
  selectedImageUrl: string | null;
}

interface ImageResource {
  id: string;
  fileName: string;
  publicUrl: string | null;
}

export default function VideoGeneratorPage() {
  const [formData, setFormData] = useState<VideoFormState>({
    prompt: '',
    selectedImageUrl: null,
  });
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [images, setImages] = useState<ImageResource[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);

  useEffect(() => {
    const fetchImageLibrary = async () => {
      setIsLoadingImages(true);
      try {
        const response = await fetch('/api/images');
        if (!response.ok) throw new Error('Failed to fetch image library.');
        const data = await response.json();
        setImages(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load images.');
      } finally {
        setIsLoadingImages(false);
      }
    };
    fetchImageLibrary();
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageSelectAndFetch = async (image: ImageResource) => {
    if (!image.publicUrl) return;

    setFormData(prev => ({ ...prev, selectedImageUrl: image.publicUrl! }));
    setSelectedImageFile(null);

    try {
      const response = await fetch(image.publicUrl);
      const blob = await response.blob();
      const file = new File([blob], image.fileName, { type: blob.type });
      setSelectedImageFile(file);
    } catch (e) {
      console.error("Could not retrieve the selected image file:", e);
      setError("Could not retrieve the selected image file. Please try another.");
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedImageFile) {
      setError('Please select an image from your library.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedVideoUrl(null);

    try {
      const formDataToSubmit = new FormData();
      formDataToSubmit.append('file', selectedImageFile);
      formDataToSubmit.append('prompt', formData.prompt);

      const response = await fetch('/api/generate-video', {
        method: 'POST',
        body: formDataToSubmit,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate video.');
      }

      setGeneratedVideoUrl(result.videoUrl);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
          <Video className="mr-3 h-8 w-8 text-indigo-500" />
          Image-to-Video Generator
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Select an image from your library and provide a motion prompt to generate a short video clip.
        </p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white flex items-center">
                <ImageIconLucide className="mr-2 h-5 w-5" />
                1. Select a Base Image
            </h2>
            {isLoadingImages ? (
                <div className="flex justify-center items-center h-64 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400"/>
                </div>
            ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-96 overflow-y-auto p-2 border rounded-md custom-scrollbar">
                    {images.map(image => (
                        <div
                            key={image.id}
                            onClick={() => handleImageSelectAndFetch(image)}
                            className={`relative aspect-square rounded-md overflow-hidden cursor-pointer transition-all duration-200 ${formData.selectedImageUrl === image.publicUrl ? 'ring-4 ring-offset-2 ring-indigo-500' : 'hover:opacity-80'}`}
                        >
                            {image.publicUrl && (
                                <NextImage src={image.publicUrl} alt={image.fileName} layout="fill" objectFit="cover" />
                            )}
                            {formData.selectedImageUrl === image.publicUrl && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                    <CheckCircle className="h-8 w-8 text-white" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <label htmlFor="prompt" className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                <Film size={16} className="mr-2" />
                2. Motion Prompt
              </label>
              <textarea
                id="prompt" name="prompt" rows={4}
                value={formData.prompt} onChange={handleInputChange}
                className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
                placeholder="e.g., 'camera pans left', 'subtle zoom in', 'wind blowing through the trees'"
                required
              />
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={isLoading || !selectedImageFile} className="px-8 py-3 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center justify-center">
                {isLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Generating Video...</>) : ('Generate Video')}
              </button>
            </div>
          </div>
        </form>
      </div>

      {error && <div className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm flex items-center"><AlertCircle className="inline mr-2 h-5 w-5"/>Error: {error}</div>}

      {generatedVideoUrl && (
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Your Generated Video</h2>
            <div className="aspect-video w-full bg-black rounded-md overflow-hidden">
                <video key={generatedVideoUrl} controls autoPlay loop className="w-full h-full">
                    <source src={generatedVideoUrl} type="video/mp4" />
                    Your browser does not support the video tag.
                </video>
            </div>
        </div>
      )}
    </div>
  );
}