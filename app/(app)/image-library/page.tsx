// app/(app)/image-library/page.tsx
"use client";

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { 
    UploadCloud, 
    Image as ImageIconLucide, // Renamed to avoid conflict with Next/Image
    Trash2, 
    RefreshCw, 
    Loader2, 
    AlertCircle 
} from 'lucide-react';
import NextImage from 'next/image'; // Using Next.js Image component

interface ImageResource {
  id: string;
  fileName: string;
  fileType?: string | null;
  publicUrl?: string | null;
  aiGeneratedDescription?: string | null;
  uploadedAt: string; // Dates from JSON are strings
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
}

export default function ImageLibraryPage() {
  const [images, setImages] = useState<ImageResource[]>([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);

  const fetchImageLibrary = async () => {
    setIsLoadingImages(true);
    setFetchError(null);
    setStatusMessage(null); // Clear previous status messages
    try {
      const response = await fetch('/api/images');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: `Failed to fetch image library: ${response.status}` }));
        throw new Error(errorData.message);
      }
      const data: ImageResource[] = await response.json();
      setImages(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred while fetching images.';
      setFetchError(errorMessage);
      console.error("Error fetching image library:", err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    fetchImageLibrary();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (!file.type.startsWith('image/')) {
        setStatusMessage({ type: 'error', text: 'Invalid file type. Please select an image (e.g., PNG, JPG, GIF, WebP).' });
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setStatusMessage(null);
    } else {
      setSelectedFile(null);
    }
  };

  const handleImageUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatusMessage({type: 'error', text: "Please select an image file first."});
      return;
    }
    setIsUploading(true);
    setStatusMessage({type: 'info', text: `Uploading "${selectedFile.name}" and generating description...`});

    const uploadFormData = new FormData();
    uploadFormData.append('file', selectedFile);

    try {
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: uploadFormData,
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Image upload or description generation failed.');
      }
      
      setStatusMessage({type: 'success', text: `Success: "${result.imageResource.fileName}" uploaded and described!`});
      setSelectedFile(null);
      if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      await fetchImageLibrary(); // Refresh the list of images
    } catch (error) {
      console.error("Image upload error:", error);
      setStatusMessage({type: 'error', text: `Upload Error: ${error instanceof Error ? error.message : 'Unknown upload error.'}`});
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDeleteImage = async (imageId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete the image "${fileName}"? This action cannot be undone.`)) {
      return;
    }
    setDeletingImageId(imageId);
    setStatusMessage({type: 'info', text: `Deleting "${fileName}"...`});
    try {
      // TODO: Create an API route for deleting images: DELETE /api/images/[imageId]
      // This route should delete from Supabase Storage and the Prisma ImageResource table.
      // For now, simulating and removing from local state:
      console.warn(`Simulating delete for image ID: ${imageId}. Backend delete not yet implemented.`);
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      // For testing UI, let's actually remove it from the local state
      setImages(prevImages => prevImages.filter(img => img.id !== imageId));
      setStatusMessage({type: 'success', text: `"${fileName}" (simulated locally) deleted successfully! Implement backend delete.`});
      // throw new Error("Delete functionality not yet implemented on backend."); // Uncomment to test error state

    } catch (error) {
      console.error("Error deleting image:", error);
      setStatusMessage({type: 'error', text: `Delete Error: ${error instanceof Error ? error.message : 'Unknown error'}`});
    } finally {
      setDeletingImageId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Image Library
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Upload images to your brand library. AI will automatically generate descriptions for them.
        </p>

        {/* Image Upload Section */}
        <form onSubmit={handleImageUpload} className="mb-8 p-4 border border-dashed border-indigo-300 dark:border-indigo-600 rounded-lg bg-indigo-50 dark:bg-gray-800/50 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-white">Upload New Image</h2>
          <div>
            <label htmlFor="image-upload-input" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Image File
            </label>
            <div className="mt-1 flex items-center space-x-3">
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                    Choose Image
                </button>
                <input 
                    id="image-upload-input"
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileSelect} 
                    className="hidden" 
                    accept="image/png, image/jpeg, image/gif, image/webp" // Common image types
                />
                {selectedFile && <span className="text-sm text-gray-600 dark:text-gray-400">{selectedFile.name}</span>}
            </div>
          </div>

          {selectedFile && (
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60"
            >
              <UploadCloud size={18} className="mr-2" />
              {isUploading ? 'Uploading & Describing...' : 'Upload & Generate Description'}
            </button>
          )}
          {statusMessage && (
            <p className={`mt-2 text-sm font-medium p-2 rounded-md ${
                statusMessage.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 
                statusMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
                'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            }`}>
              {statusMessage.text}
            </p>
          )}
        </form>

        {/* List of Uploaded Images */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-white">Your Images</h2>
            <button onClick={fetchImageLibrary} disabled={isLoadingImages || isUploading || !!deletingImageId} className="p-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-md disabled:opacity-50">
                <RefreshCw size={16} className={(isLoadingImages || isUploading || !!deletingImageId) ? "animate-spin" : ""} />
            </button>
          </div>
          {isLoadingImages && <div className="text-center py-4"><Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-500" /></div>}
          {fetchError && <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm"><AlertCircle className="inline mr-2 h-5 w-5"/>Error: {fetchError}</div>}
          {!isLoadingImages && !fetchError && images.length === 0 && (
            <p className="text-gray-500 dark:text-gray-400 py-4 text-center">No images uploaded yet. Use the form above to add some.</p>
          )}
          {!isLoadingImages && !fetchError && images.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"> {/* Increased gap */}
              {images.map((image) => (
                <div key={image.id} className="bg-slate-50 dark:bg-gray-700/60 rounded-lg shadow-lg overflow-hidden flex flex-col"> {/* Increased shadow, flex-col */}
                  {image.publicUrl ? (
                    <div className="w-full h-48 relative block"> {/* Ensure image can be clicked if wrapped in Link */}
                        <NextImage 
                            src={image.publicUrl} 
                            alt={image.aiGeneratedDescription || image.fileName} 
                            layout="fill"
                            objectFit="cover"
                            className="transition-transform duration-300 hover:scale-105"
                        />
                    </div>
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                      <ImageIconLucide className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  <div className="p-4 space-y-2 flex-grow flex flex-col justify-between"> {/* Padding, spacing, flex-grow */}
                    <div>
                        <h3 className="font-semibold text-base text-gray-800 dark:text-slate-100 truncate" title={image.fileName}>
                        {image.fileName}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                            {(image.fileSize && image.fileSize > 0) ? `${(image.fileSize / (1024*1024)).toFixed(2)} MB` : ''} 
                            {image.width && image.height && ` - ${image.width}x${image.height}`}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-300 h-20 overflow-y-auto custom-scrollbar pr-1" title={image.aiGeneratedDescription || ""}>
                        <span className="font-medium">AI Description:</span> {image.aiGeneratedDescription || 'N/A'}
                        </p>
                    </div>
                    <div className="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            {new Date(image.uploadedAt).toLocaleDateString()}
                        </p>
                        <button 
                        onClick={() => handleDeleteImage(image.id, image.fileName)}
                        disabled={!!deletingImageId}
                        className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50"
                        title="Delete Image"
                        >
                        {deletingImageId === image.id ? <Loader2 size={18} className="animate-spin"/> : <Trash2 size={18} />}
                        </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}