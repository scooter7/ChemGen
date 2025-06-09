// app/(app)/brand-materials/page.tsx
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

// We will import pdfjs dynamically inside a useEffect hook to avoid server-side rendering issues.
// import * as pdfjs from 'pdfjs-dist'; <-- DO NOT IMPORT HERE

interface SourceMaterial {
  id: string;
  fileName: string;
  fileType?: string | null;
  uploadedAt: string;
  status: string; 
}

export default function BrandMaterialsPage() {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfjs, setPdfjs] = useState<any>(null); // State to hold the pdfjs module

  // Dynamically load pdfjs-dist only on the client-side
  useEffect(() => {
    import('pdfjs-dist').then(pdfjsModule => {
      pdfjsModule.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsModule.version}/pdf.worker.mjs`;
      setPdfjs(pdfjsModule);
    });
  }, []);
  
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!pdfjs) {
        setStatusMessage({type: 'error', text: 'PDF library is not loaded yet. Please wait a moment.'});
        return;
    }

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
        setStatusMessage({type: 'info', text: `Selected "${file.name}". Non-PDF files will be stored without text content.`});
    }
  };

  const fetchMaterials = async () => {
    setIsLoadingMaterials(true);
    setFetchError(null);
    try {
      const response = await fetch('/api/source-materials');
      if (!response.ok) {
        throw new Error(`Failed to fetch materials: ${response.status}`);
      }
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
    if (extractedText) uploadFormData.append('extractedText', extractedText);

    try {
      const response = await fetch('/api/source-materials/upload', { method: 'POST', body: uploadFormData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'File upload failed.');
      
      setStatusMessage({type: 'success', text: `Success: "${result.sourceMaterial.fileName}" was uploaded and indexed!`});
      
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
    if (!window.confirm(`Are you sure you want to delete "${fileName}"? This will also remove its processed data.`)) {
      return;
    }
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
    if (!fileType) return <FileText className="h-6 w-6 text-gray-500" />;
    if (fileType.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-blue-500" />;
    if (fileType === 'application/pdf') return <FileText className="h-6 w-6 text-red-500" />;
    return <FileText className="h-6 w-6 text-gray-500" />;
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Brand Materials</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Upload documents to provide context for AI content generation. PDFs will be parsed for text in your browser before upload.</p>

        <form onSubmit={handleFileUpload} className="mb-8 p-4 border border-dashed rounded-lg space-y-4">
          <h2 className="text-lg font-semibold">Upload New Material</h2>
          <div>
            <label htmlFor="file-upload" className="block text-sm font-medium mb-1">Select File</label>
            <div className="flex items-center space-x-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 border rounded-md text-sm font-medium bg-white hover:bg-gray-50">Choose File</button>
              <input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="application/pdf,.doc,.docx,.txt" />
              {selectedFile && <span className="text-sm">{selectedFile.name}</span>}
              {isParsing && <Loader2 size={16} className="animate-spin" />}
            </div>
          </div>
          
          {selectedFile && (
            <>
              <div>
                <label htmlFor="fileDescription" className="block text-sm font-medium mb-1">Description (Optional)</label>
                <textarea id="fileDescription" rows={2} value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} placeholder="Brief description..." className="block w-full text-sm rounded-md border-gray-300 shadow-sm"/>
              </div>
              <button type="submit" disabled={isUploading || isParsing} className="w-full sm:w-auto flex items-center justify-center px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60">
                <UploadCloud size={18} className="mr-2" />
                {isUploading ? 'Uploading...' : 'Upload & Index'}
              </button>
            </>
          )}

          {statusMessage && (
            <p className={`mt-2 text-sm font-medium p-2 rounded-md ${
                statusMessage.type === 'error' ? 'bg-red-100 text-red-700' : 
                statusMessage.type === 'success' ? 'bg-green-100 text-green-700' : 
                'bg-blue-100 text-blue-700'
            }`}>
              {statusMessage.text}
            </p>
          )}
        </form>

        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Uploaded Materials</h2>
            <button onClick={fetchMaterials} disabled={isLoadingMaterials || isUploading || !!deletingMaterialId} className="p-2 text-sm rounded-md disabled:opacity-50">
                <RefreshCw size={16} className={isLoadingMaterials ? "animate-spin" : ""} />
            </button>
          </div>
          {isLoadingMaterials && <p>Loading materials...</p>}
          {fetchError && <p className="text-red-500">Error: {fetchError}</p>}
          
          <ul className="space-y-3">
            {materials.map((material) => (
              <li key={material.id} className="bg-slate-50 p-3 rounded-md shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3 min-w-0">
                  {getFileIcon(material.fileType)}
                  <p className="font-medium truncate" title={material.fileName}>{material.fileName}</p>
                   <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${material.status === 'INDEXED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>{material.status}</span>
                </div>
                <button onClick={() => handleDeleteMaterial(material.id, material.fileName)} disabled={!!deletingMaterialId} className="p-1.5 text-red-500 hover:text-red-700 rounded-full hover:bg-red-100 disabled:opacity-50">
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