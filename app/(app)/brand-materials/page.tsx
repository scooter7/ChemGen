// app/(app)/brand-materials/page.tsx
"use client";

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { UploadCloud, FileText, ImageIcon, VideoIcon, Trash2, RefreshCw, Zap, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface SourceMaterial {
  id: string;
  fileName: string;
  fileType?: string | null;
  storagePath: string;
  description?: string | null;
  uploadedAt: string;
  fileSize?: number | null;
  status: string; 
  processedAt?: string | null;
}

export default function BrandMaterialsPage() {
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [processingMaterialId, setProcessingMaterialId] = useState<string | null>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);

  const fetchMaterials = async () => {
    setIsLoadingMaterials(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/source-materials');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch materials: ${response.status}`);
      }
      const data: SourceMaterial[] = await response.json();
      setMaterials(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'An unknown error occurred while fetching materials.');
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setStatusMessage(null);
    }
  };

  const handleFileUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      setStatusMessage({type: 'error', text: "Please select a file first."});
      return;
    }
    setIsUploading(true);
    setStatusMessage({type: 'info', text: `Uploading "${selectedFile.name}"...`});

    const uploadFormData = new FormData();
    uploadFormData.append('file', selectedFile);
    if (fileDescription) uploadFormData.append('description', fileDescription);

    try {
      const response = await fetch('/api/source-materials/upload', { method: 'POST', body: uploadFormData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'File upload failed.');
      
      setStatusMessage({type: 'success', text: `Success: "${result.sourceMaterial.fileName}" uploaded!`});
      setSelectedFile(null);
      setFileDescription("");
      if(fileInputRef.current) fileInputRef.current.value = "";
      fetchMaterials(); 
    } catch (error) {
      setStatusMessage({type: 'error', text: `Upload Error: ${error instanceof Error ? error.message : 'Unknown upload error.'}`});
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleProcessMaterial = async (materialId: string, fileName: string) => {
    setProcessingMaterialId(materialId);
    setStatusMessage({type: 'info', text: `Processing "${fileName}"...`});
    try {
        const response = await fetch(`/api/source-materials/${materialId}/process`, { method: 'POST' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || `Failed to process material: ${response.status}`);
        setStatusMessage({type: 'success', text: result.message || "Material processed successfully!"});
        fetchMaterials();
    } catch (error) {
        setStatusMessage({type: 'error', text: `Processing Error: ${error instanceof Error ? error.message : 'Unknown error'}`});
    } finally {
        setProcessingMaterialId(null);
    }
  };

  const handleDeleteMaterial = async (materialId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will also remove its processed data.`)) {
      return;
    }
    setDeletingMaterialId(materialId);
    setStatusMessage({type: 'info', text: `Deleting "${fileName}"...`});
    try {
      const response = await fetch(`/api/source-materials/${materialId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || `Failed to delete material: ${response.status}`);
      }
      setStatusMessage({type: 'success', text: result.message || `"${fileName}" deleted successfully!`});
      setMaterials(prevMaterials => prevMaterials.filter(material => material.id !== materialId));
    } catch (error) {
      console.error("Error deleting material:", error);
      setStatusMessage({type: 'error', text: `Delete Error: ${error instanceof Error ? error.message : 'Unknown error'}`});
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const getFileIcon = (fileType?: string | null) => {
    if (!fileType) return <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-blue-500 dark:text-blue-400" />;
    if (fileType.startsWith('video/')) return <VideoIcon className="h-6 w-6 text-purple-500 dark:text-purple-400" />;
    if (fileType === 'application/pdf') return <FileText className="h-6 w-6 text-red-500 dark:text-red-400" />;
    return <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
        case 'UPLOADED': return <span title="Uploaded, pending processing"><UploadCloud size={16} className="text-blue-500"/></span>;
        case 'PROCESSING': return <span title="Processing..."><RefreshCw size={16} className="text-yellow-500 animate-spin"/></span>;
        case 'INDEXED': return <span title="Processed & Indexed"><CheckCircle2 size={16} className="text-green-500"/></span>;
        case 'FAILED': return <span title="Processing Failed"><AlertCircle size={16} className="text-red-500"/></span>;
        default: return null;
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Brand Materials & Knowledge Base
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Upload and manage documents, images, and videos that define your brand&apos;s persona and provide context for AI content generation.
        </p>

        <form onSubmit={handleFileUpload} className="mb-8 p-4 border border-dashed border-indigo-300 dark:border-indigo-600 rounded-lg bg-indigo-50 dark:bg-gray-800/50 space-y-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-white">Upload New Material</h2>
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select File</label>
            <div className="mt-1 flex items-center space-x-3">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">Choose File</button>
                <input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf,.doc,.docx,.txt,.md,video/*"/>
                {selectedFile && <span className="text-sm text-gray-600 dark:text-gray-400">{selectedFile.name}</span>}
            </div>
          </div>
          {selectedFile && (
            <>
              <div>
                <label htmlFor="fileDescription" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                <textarea id="fileDescription" rows={2} value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} placeholder="Brief description..." className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"/>
              </div>
              <button type="submit" disabled={isUploading || !selectedFile} className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60">
                <UploadCloud size={18} className="mr-2" />
                {isUploading ? 'Uploading...' : 'Upload to Repository'}
              </button>
            </>
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

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-700 dark:text-white">Uploaded Materials</h2>
            <button onClick={fetchMaterials} disabled={isLoadingMaterials || isUploading || !!processingMaterialId || !!deletingMaterialId} className="p-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-gray-700 rounded-md disabled:opacity-50">
                <RefreshCw size={16} className={(isLoadingMaterials || isUploading || !!processingMaterialId || !!deletingMaterialId) ? "animate-spin" : ""} />
            </button>
          </div>
          {isLoadingMaterials && <p>Loading materials...</p>}
          {fetchError && <p className="text-red-500">Error: {fetchError}</p>}
          {!isLoadingMaterials && !fetchError && materials.length === 0 && ( <p>No brand materials uploaded yet.</p> )}
          {!isLoadingMaterials && !fetchError && materials.length > 0 && (
            <ul className="space-y-3">
              {materials.map((material) => (
                <li key={material.id} className="bg-slate-50 dark:bg-gray-700/50 p-3 rounded-md shadow flex items-center justify-between space-x-3">
                  <div className="flex items-center space-x-3 flex-grow min-w-0">
                    {getFileIcon(material.fileType)}
                    <div className="flex-grow min-w-0">
                      <a href={material.storagePath} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate block" title={material.fileName}>{material.fileName}</a>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={material.description || ""}>{material.description || 'No description'}</p>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-gray-400 dark:text-gray-500"> {new Date(material.uploadedAt).toLocaleDateString()}</span>
                        {getStatusIcon(material.status)}
                        <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{material.status.toLowerCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center space-x-2">
                    {(material.status === 'UPLOADED' || material.status === 'FAILED') && (
                      <button onClick={() => handleProcessMaterial(material.id, material.fileName)} disabled={!!processingMaterialId || !!deletingMaterialId} className="p-1.5 text-sm text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed" title="Process & Index Material">
                        {processingMaterialId === material.id ? <Loader2 size={16} className="animate-spin"/> : <Zap size={16} />}
                      </button>
                    )}
                    <button onClick={() => handleDeleteMaterial(material.id, material.fileName)} disabled={!!deletingMaterialId || !!processingMaterialId} className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed" title="Delete Material">
                      {deletingMaterialId === material.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}