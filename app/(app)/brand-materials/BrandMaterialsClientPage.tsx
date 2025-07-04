// app/(app)/brand-materials/BrandMaterialsClientPage.tsx
"use client";

import React, { useState, useEffect, useRef, FormEvent } from 'react';
import {
    UploadCloud,
    FileText,
    ImageIcon,
    Trash2,
    RefreshCw,
    Loader2
} from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// THE FIX: Hardcode the workerSrc URL to the EXACT version reported in the runtime error log.
// This ensures the main library and the worker script are perfectly synchronized.
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

interface SourceMaterial {
  id: string;
  fileName: string;
  fileType?: string | null;
  uploadedAt: string;
  status: string;
}

export default function BrandMaterialsClientPage() {
  const [materials, setMaterials] = useState<SourceMaterial[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);

  const fetchMaterials = async () => {
    setIsLoadingMaterials(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/source-materials');
      if (!response.ok) throw new Error(`Failed to fetch materials: ${response.status}`);
      const data: SourceMaterial[] = await response.json();
      setMaterials(data);
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoadingMaterials(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setExtractedText(null);
      return;
    }

    setSelectedFile(file);
    setStatusMessage(null);
    setExtractedText(null);

    if (file.type === 'application/pdf') {
      setIsParsing(true);
      setStatusMessage({type: 'info', text: `Parsing "${file.name}" in your browser...`});
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          if (e.target?.result) {
            const typedArray = new Uint8Array(e.target.result as ArrayBuffer);
            const doc = await pdfjs.getDocument(typedArray).promise;
            let fullText = '';
            for (let i = 1; i <= doc.numPages; i++) {
              const page = await doc.getPage(i);
              const content = await page.getTextContent();
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const strings = content.items.map((item: any) => 'str' in item ? item.str : '');
              fullText += strings.join(' ') + '\n';
            }
            setExtractedText(fullText);
            setStatusMessage({type: 'success', text: `Successfully parsed "${file.name}". Ready to upload.`});
          }
        };
        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Client-side parsing error:", error);
        setStatusMessage({type: 'error', text: `Could not parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`});
        setExtractedText(null);
      } finally {
        setIsParsing(false);
      }
    } else {
        setStatusMessage({type: 'info', text: `Selected "${file.name}". This file will be stored without text analysis.`});
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
    if (extractedText !== null) uploadFormData.append('extractedText', extractedText);

    try {
      const response = await fetch('/api/source-materials/upload', { method: 'POST', body: uploadFormData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'File upload failed.');

      setStatusMessage({type: 'success', text: result.message});

      setSelectedFile(null);
      setFileDescription("");
      setExtractedText(null);
      if(fileInputRef.current) fileInputRef.current.value = "";

      fetchMaterials();
    } catch (error) {
      setStatusMessage({type: 'error', text: `Upload Error: ${error instanceof Error ? error.message : 'Unknown upload error.'}`});
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string, fileName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will also remove its processed data.`)) return;
    setDeletingMaterialId(materialId);
    try {
      const response = await fetch(`/api/source-materials/${materialId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete material');
      setStatusMessage({type: 'success', text: `"${fileName}" deleted successfully!`});
      setMaterials(prev => prev.filter(material => material.id !== materialId));
    } catch (error) {
      setStatusMessage({type: 'error', text: `Delete Error: ${error instanceof Error ? error.message : 'Unknown error'}`});
    } finally {
      setDeletingMaterialId(null);
    }
  };

  const getFileIcon = (fileType?: string | null) => {
    if (!fileType) return <FileText className="h-6 w-6 text-gray-400" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-blue-400" />;
    if (fileType === 'application/pdf') return <FileText className="h-6 w-6 text-red-400" />;
    return <FileText className="h-6 w-6 text-gray-400" />;
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold text-white mb-6">Brand Materials</h1>
        <p className="text-gray-300 mb-6">Upload documents to provide context for AI content generation. PDFs will be parsed for text in your browser before upload.</p>
        <form onSubmit={handleFileUpload} className="mb-8 p-4 border border-dashed border-gray-600 rounded-lg space-y-4">
          <h2 className="text-lg font-semibold text-white">Upload New Material</h2>
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium text-gray-300 mb-1">Select File</label>
            <div className="flex items-center space-x-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border border-gray-600 rounded-md text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600">Choose File</button>
              <input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="application/pdf,.doc,.docx,.txt" />
              {selectedFile && <span className="text-sm text-gray-400">{selectedFile.name}</span>}
              {isParsing && <Loader2 size={16} className="animate-spin text-gray-400" />}
            </div>
          </div>
          {selectedFile && (
            <>
              <div>
                <label htmlFor="fileDescription" className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
                <textarea id="fileDescription" rows={2} value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} placeholder="Brief description..." className="block w-full text-sm rounded-md border-gray-600 bg-gray-700 shadow-sm"/>
              </div>
              <button type="submit" disabled={isUploading || isParsing} className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60">
                <UploadCloud size={18} className="mr-2" />
                {isUploading ? 'Uploading...' : 'Upload & Index'}
              </button>
            </>
          )}
          {statusMessage && (
            <p className={`mt-2 text-sm font-medium p-2 rounded-md ${
                statusMessage.type === 'error' ? 'bg-red-900/30 text-red-300' :
                statusMessage.type === 'success' ? 'bg-green-900/30 text-green-300' :
                'bg-blue-900/30 text-blue-300'
            }`}>
              {statusMessage.text}
            </p>
          )}
        </form>
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-white">Uploaded Materials</h2>
            <button onClick={fetchMaterials} disabled={isLoadingMaterials || isUploading || !!deletingMaterialId} className="p-2 text-sm text-indigo-400 rounded-md disabled:opacity-50 hover:bg-gray-700">
                <RefreshCw size={16} className={isLoadingMaterials ? "animate-spin" : ""} />
            </button>
          </div>
          {isLoadingMaterials && <div className="text-center py-4"><Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-500"/></div>}
          {fetchError && <p className="text-red-400">Error: {fetchError}</p>}
          <ul className="space-y-3">
            {materials.map((material) => (
              <li key={material.id} className="bg-gray-700/50 p-3 rounded-md shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  {getFileIcon(material.fileType)}
                  <p className="font-medium text-gray-200 truncate" title={material.fileName}>{material.fileName}</p>
                   <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${material.status === 'INDEXED' ? 'bg-green-200 text-green-900' : 'bg-yellow-200 text-yellow-900'}`}>{material.status}</span>
                </div>
                <button onClick={() => handleDeleteMaterial(material.id, material.fileName)} disabled={!!deletingMaterialId} className="p-1.5 text-red-400 hover:text-red-300 rounded-full hover:bg-red-900/50 disabled:opacity-50">
                  {deletingMaterialId === material.id ? <Loader2 size={16} className="animate-spin"/> : <Trash2 size={16} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}