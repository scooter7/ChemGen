// app/_components/marketing-content/ContentCreationForm.tsx
"use client";

import React, { useState, FormEvent, useEffect, useRef } from 'react';
import {
  Users, Type, Hash, Aperture, MessageSquareText, Paperclip,
  FolderSearch, Info, RefreshCcw, Settings2, Tags,
  Copy, Download, AlertTriangle, ThumbsUp, PlusCircle,
  Image as ImageIconLucide, // For image recommendations section & attach button
  Loader2, // For loading states
  UploadCloud // For the attach file upload button
} from 'lucide-react';
import RichTextEditor from '@/app/_components/ui/RichTextEditor'; // Ensure this path is correct
import NextImage from 'next/image'; // For displaying recommended images
import ArchetypeRefinementModal from './ArchetypeRefinementModal'; 
import { type Archetype, samfordClientArchetypes } from './archetypeData'; // Ensure this path is correct

interface FormData {
  audience: string;
  mediaType: string;
  textCount: number;
  textCountUnit: 'characters' | 'words';
  dominantArchetype: string;
  archetypeRefinements: Record<string, number>; 
  prompt: string;
  sourceMaterials: string[]; // Stores names/IDs of referenced materials
}

interface GeneratedData {
  generatedText: string;
  justification?: string;
}

interface ApiResponse {
  message: string;
  data?: GeneratedData;
  error?: string;
  debugInfo?: any;
}

interface AvailableSourceMaterial {
  id: string;
  fileName: string;
  status: string;
}

interface RecommendedImage {
    id: string;
    fileName: string;
    publicUrl?: string | null;
    aiGeneratedDescription?: string | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
}

export default function ContentCreationForm() {
  const initializeArchetypeRefinements = (): Record<string, number> => {
    const refinements: Record<string, number> = {};
    const archetypesToUse = samfordClientArchetypes || [];
    const numArchetypes = archetypesToUse.length;

    if (numArchetypes > 0) {
      const leaderName = "Established Leader";
      const inspirerName = "Classic Inspirer";
      const shepherdName = "Loyal Shepherd";

      const defaultValues: Record<string, number> = {
        [shepherdName]: 50,
        [inspirerName]: 25,
        [leaderName]: 25,
      };
      
      archetypesToUse.forEach(arch => {
        refinements[arch.name] = defaultValues[arch.name] !== undefined ? defaultValues[arch.name] : 0;
      });

      let currentSum = Object.values(refinements).reduce((s, v) => s + (v || 0), 0);
      if (currentSum !== 100 && archetypesToUse.length > 0) {
        const diff = 100 - currentSum;
        const primaryArchetypeForAdjustment = 
            archetypesToUse.find(arch => arch.name === shepherdName && (refinements[arch.name] + diff >=0)) || 
            archetypesToUse.find(arch => arch.name === leaderName && (refinements[arch.name] + diff >=0)) || 
            archetypesToUse.find(arch => arch.name === inspirerName && (refinements[arch.name] + diff >=0)) || 
            archetypesToUse.find(arch => (refinements[arch.name] > 0 && refinements[arch.name] + diff >= 0)) || // first with existing value
            archetypesToUse[0]; 
        if (primaryArchetypeForAdjustment) {
           refinements[primaryArchetypeForAdjustment.name] = (refinements[primaryArchetypeForAdjustment.name] || 0) + diff;
        }
      }
       samfordClientArchetypes.forEach(arch => { // Ensure all from samfordClientArchetypes are present
        if (!(arch.name in refinements)) {
          refinements[arch.name] = 0;
        }
      });
    }
    return refinements;
  };
  
  const [formData, setFormData] = useState<Partial<FormData>>({
    audience: '',
    mediaType: '',
    textCount: 100,
    textCountUnit: 'characters',
    dominantArchetype: samfordClientArchetypes.find(arch => arch.name === "Loyal Shepherd")?.name || (samfordClientArchetypes.length > 0 ? samfordClientArchetypes[0].name : ''),
    archetypeRefinements: initializeArchetypeRefinements(),
    prompt: '',
    sourceMaterials: [],
  });

  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState<GeneratedData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editableContent, setEditableContent] = useState<string>("");

  const [availableMaterials, setAvailableMaterials] = useState<AvailableSourceMaterial[]>([]);
  const [isLoadingAvailableMaterials, setIsLoadingAvailableMaterials] = useState(false);
  const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<string>("");
  const [currentSourceMaterialText, setCurrentSourceMaterialText] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState<string>("");
  const [isUploadingSourceMaterial, setIsUploadingSourceMaterial] = useState<boolean>(false);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<string | null>(null);

  const [showArchetypeRefinementModal, setShowArchetypeRefinementModal] = useState(false);
  const [imageRecommendations, setImageRecommendations] = useState<RecommendedImage[] | null>(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState<boolean>(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [generalStatusMessage, setGeneralStatusMessage] = useState<{type: 'success' | 'error' | 'info', text: string} | null>(null);

  useEffect(() => {
    if (generatedData?.generatedText) {
      setEditableContent(generatedData.generatedText);
      setImageRecommendations(null); 
      setRecommendationError(null);
    } else {
      setEditableContent("");
    }
  }, [generatedData]);

  useEffect(() => {
    const fetchIndexedMaterials = async () => {
      setIsLoadingAvailableMaterials(true);
      try {
        const response = await fetch('/api/source-materials?status=INDEXED');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({message: 'Failed to fetch indexed materials'}));
            throw new Error(errorData.message);
        }
        const data: AvailableSourceMaterial[] = await response.json();
        setAvailableMaterials(data);
      } catch (error) {
        console.error("Error fetching available materials:", error);
        setApiError(error instanceof Error ? error.message : "Failed to load source materials for selection.");
      } finally {
        setIsLoadingAvailableMaterials(false);
      }
    };
    fetchIndexedMaterials();
  }, []);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTextCountChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, textCount: parseInt(event.target.value, 10) || 0 }));
  };

  const handleTextCountUnitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, textCountUnit: event.target.value as FormData['textCountUnit'] }));
  };

  const handleApplyArchetypeRefinements = (newRefinements: Record<string, number>) => {
    const validRefinements: Record<string, number> = {};
    let currentSum = 0;
    samfordClientArchetypes.forEach(arch => {
        validRefinements[arch.name] = newRefinements[arch.name] || 0;
        currentSum += validRefinements[arch.name];
    });

    // Normalize if sum is not 100 (though modal should enforce this)
    if (currentSum !== 100 && samfordClientArchetypes.length > 0) {
        console.warn("Refinements from modal do not sum to 100. Normalizing.", validRefinements);
        // Simple normalization: scale or adjust. For now, just log. Ideally, modal ensures this.
    }

    setFormData(prev => ({
      ...prev!, 
      archetypeRefinements: validRefinements,
    }));
    
    let maxPercentage = -1;
    let newDominantArchetype = formData.dominantArchetype || (samfordClientArchetypes.length > 0 ? samfordClientArchetypes[0].name : '');    
    
    Object.entries(validRefinements).forEach(([name, percentage]) => {
        if (percentage > maxPercentage) {
            maxPercentage = percentage;
            newDominantArchetype = name;
        } else if (percentage === maxPercentage && percentage > 0) {
             if (name !== formData.dominantArchetype && samfordClientArchetypes.find(a => a.name === name)) {
                 newDominantArchetype = name;
            }
        }
    });

    if (maxPercentage >= 0 && samfordClientArchetypes.find(a => a.name === newDominantArchetype)) { 
        setFormData(prev => ({...prev!, dominantArchetype: newDominantArchetype}));
    } else if (samfordClientArchetypes.length > 0) { 
        setFormData(prev => ({...prev!, dominantArchetype: samfordClientArchetypes[0].name}));
    } else {
        setFormData(prev => ({...prev!, dominantArchetype: ''}));
    }
  };

  const handleAddSelectedMaterialToForm = () => { 
    if (selectedMaterialToAdd) {
      const material = availableMaterials.find(m => m.id === selectedMaterialToAdd);
      if (material && !formData.sourceMaterials?.includes(material.fileName)) {
        setFormData(prev => ({ ...prev, sourceMaterials: [...(prev.sourceMaterials || []), material.fileName] }));
      }
      setSelectedMaterialToAdd("");
    }
  };
  
  const handleAddCustomMaterialTag = () => { 
    if (currentSourceMaterialText.trim() && !formData.sourceMaterials?.includes(currentSourceMaterialText.trim())) {
      setFormData(prev => ({ ...prev, sourceMaterials: [...(prev.sourceMaterials || []), currentSourceMaterialText.trim()] }));
      setCurrentSourceMaterialText('');
    }
  };

  const handleRemoveSourceMaterial = (materialToRemove: string) => { 
    setFormData(prev => ({ ...prev, sourceMaterials: prev.sourceMaterials?.filter(m => m !== materialToRemove) }));
  };
  
  const handleFileSelectForUpload = (event: React.ChangeEvent<HTMLInputElement>) => { 
    if (event.target.files && event.target.files[0]) {
      setSelectedFileForUpload(event.target.files[0]);
      setUploadStatusMessage(null);
    } else {
        setSelectedFileForUpload(null);
    }
  };

  const handleSourceMaterialUpload = async () => { 
    if (!selectedFileForUpload) { setUploadStatusMessage("Error: Please select a file first."); return; }
    setIsUploadingSourceMaterial(true);
    setUploadStatusMessage(`Uploading "${selectedFileForUpload.name}"...`);
    const uploadFormDataObj = new FormData();
    uploadFormDataObj.append('file', selectedFileForUpload);
    if (fileDescription) uploadFormDataObj.append('description', fileDescription);
    try {
      const response = await fetch('/api/source-materials/upload', { method: 'POST', body: uploadFormDataObj });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'File upload failed.');
      
      setUploadStatusMessage(`Success: "${result.sourceMaterial.fileName}" uploaded! It may need processing before appearing in selections.`);
      setSelectedFileForUpload(null); 
      setFileDescription(""); 
      if(fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadStatusMessage(`Error: ${error instanceof Error ? error.message : 'Unknown upload error.'}`);
    } finally {
      setIsUploadingSourceMaterial(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setGeneratedData(null);
    setApiError(null);
    setImageRecommendations(null);
    setRecommendationError(null);
    setGeneralStatusMessage(null);

    const payload = {
        ...formData,
        archetypeRefinements: formData.archetypeRefinements || initializeArchetypeRefinements() 
    };
    console.log("Form Data Submitted to API:", payload);

    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result: ApiResponse = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Failed to generate content.');
      if (result.data) {
        setGeneratedData(result.data);
        console.log("Debug Info from API:", result.debugInfo);
      } else {
        setApiError("Received an unexpected response format from the server.");
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "An error occurred while generating content.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchImageRecommendations = async () => {
    if (!editableContent && !generatedData?.generatedText) {
      setRecommendationError("Please generate or have text content available to get image recommendations.");
      return;
    }
    setIsLoadingRecommendations(true);
    setImageRecommendations(null);
    setRecommendationError(null);
    setGeneralStatusMessage(null);
    const textToSearch = editableContent || generatedData?.generatedText || "";
    try {
      const response = await fetch('/api/images/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textContent: textToSearch, topN: 3 }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to fetch image recommendations.");
      }
      setImageRecommendations(result.recommendations || []);
      if (!result.recommendations || result.recommendations.length === 0) {
        setGeneralStatusMessage({type: 'info', text: "No specific image recommendations found based on the text."});
      }
    } catch (error) {
      setRecommendationError(error instanceof Error ? error.message : "An error occurred while fetching recommendations.");
      console.error("Error fetching image recommendations:", error);
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const audienceOptions = ["Prospective Students", "Alumni", "Donors", "Campus Community", "Parents & Families"];
  const mediaTypeOptions = ["Email Newsletter", "Social Media Post", "Blog Article", "Press Release", "Content/SEO"];
  const textCountUnitOptions = ["characters", "words"];
  const archetypeOptionsForDropdown = samfordClientArchetypes.map(arch => arch.name);

  const LabelWithIcons = ({ label, htmlFor, icon: IconComponent }: { label: string, htmlFor?: string, icon: React.ElementType }) => (
    <label htmlFor={htmlFor} className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
      <IconComponent size={18} className="mr-2 text-gray-500 dark:text-gray-400" />
      {label}
      <Info size={14} className="ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer" onClick={() => alert(`More information about ${label}`)} />
    </label>
  );

  const resetForm = () => {
    setFormData({ 
        audience: '', 
        mediaType: '', 
        textCount: 100, 
        textCountUnit: 'characters', 
        dominantArchetype: samfordClientArchetypes.length > 0 ? samfordClientArchetypes[0].name : '', 
        archetypeRefinements: initializeArchetypeRefinements(), 
        prompt: '', 
        sourceMaterials: [] 
    }); 
    setGeneratedData(null); 
    setApiError(null); 
    setSelectedFileForUpload(null); 
    setUploadStatusMessage(null); 
    if(fileInputRef.current) fileInputRef.current.value = ""; 
    setEditableContent(""); 
    setImageRecommendations(null); 
    setRecommendationError(null); 
    setGeneralStatusMessage(null);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 md:p-8 shadow-xl rounded-lg">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Hi {/** TODO: Get user's name */}, what do you want to say?
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Audience Selector */}
        <div><LabelWithIcons label="Audience" htmlFor="audience" icon={Users} /><select id="audience" name="audience" value={formData.audience || ''} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="">Select Audience</option>{audienceOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
        
        {/* Media Type Selector */}
        <div><LabelWithIcons label="Media Type" htmlFor="mediaType" icon={Type} /><select id="mediaType" name="mediaType" value={formData.mediaType || ''} onChange={handleChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"><option value="">Select Media Type</option>{mediaTypeOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select></div>
        
        {/* Text Count */}
        <div><LabelWithIcons label="Text Count" icon={Hash} /><div className="grid grid-cols-2 gap-4"><input type="number" id="textCount" name="textCount" value={formData.textCount || 0} onChange={handleTextCountChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" placeholder="100"/><select id="textCountUnit" name="textCountUnit" value={formData.textCountUnit || 'characters'} onChange={handleTextCountUnitChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">{textCountUnitOptions.map(opt => <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>)}</select></div></div>
        
        {/* Dominant Brand Archetype */}
        <div>
            <LabelWithIcons label="Dominant Brand Archetype" htmlFor="dominantArchetype" icon={Aperture} />
            <div className="flex items-center space-x-3">
                <select 
                    id="dominantArchetype" 
                    name="dominantArchetype" 
                    value={formData.dominantArchetype || ''} 
                    onChange={handleChange} 
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                >
                    <option value="">Select Dominant Archetype</option>
                    {archetypeOptionsForDropdown.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <button
                    type="button"
                    onClick={() => setShowArchetypeRefinementModal(true)}
                    className="mt-1 flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 whitespace-nowrap"
                >
                    <Settings2 size={16} className="mr-2 flex-shrink-0" /> Refine
                </button>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-1">
                {formData.archetypeRefinements && Object.entries(formData.archetypeRefinements)
                    .filter(([, percentage]) => percentage > 0)
                    .sort(([, a], [, b]) => b - a) 
                    .map(([name, percentage]) => (
                        <span key={name} className="inline-block bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-200">
                            {name}: {percentage}%
                        </span>
                ))}
            </div>
        </div>
        
        {/* Prompt Textarea and File Upload Section */}
        <div>
          <LabelWithIcons label="Prompt (include instructions and purpose)" htmlFor="prompt" icon={MessageSquareText} />
          <textarea id="prompt" name="prompt" rows={4} value={formData.prompt || ''} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" placeholder="Create a virtual admissions event email..." required />
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <input type="file" ref={fileInputRef} onChange={handleFileSelectForUpload} className="hidden" accept="application/pdf,.doc,.docx,.txt,.md" />
            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <Paperclip size={16} className="mr-2" /> Attach Source File
            </button>
            <button type="button" className="flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                <FolderSearch size={16} className="mr-2" /> Browse Prompts
            </button>
            {selectedFileForUpload && (
              <div className="w-full mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md space-y-2 bg-indigo-50 dark:bg-indigo-900/30">
                <p className="text-sm text-gray-700 dark:text-gray-300">Selected: <span className="font-medium">{selectedFileForUpload.name}</span> ({ (selectedFileForUpload.size / 1024).toFixed(2) } KB)</p>
                <input type="text" placeholder="Optional: File description" value={fileDescription} onChange={(e) => setFileDescription(e.target.value)} className="block w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white"/>
                <button type="button" onClick={handleSourceMaterialUpload} disabled={isUploadingSourceMaterial} className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-60">
                  <UploadCloud size={16} className="mr-2" />
                  {isUploadingSourceMaterial ? 'Uploading...' : 'Upload Selected File'}
                </button>
              </div>
            )}
             {uploadStatusMessage && (<p className={`w-full mt-2 text-sm font-medium p-2 rounded-md ${uploadStatusMessage.startsWith('Error:') ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : (uploadStatusMessage.startsWith('Success:') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300')}`}>{uploadStatusMessage}</p>)}
          </div>
        </div>

        {/* Reference the Following Source Material(s) */}
        <div>
            <LabelWithIcons label="Reference Source Material(s)" icon={Tags} />
            <div className="flex flex-wrap gap-2 my-2 min-h-[20px]">
                {formData.sourceMaterials?.map(materialName => ( <span key={materialName} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300">{materialName}<button type="button" onClick={() => handleRemoveSourceMaterial(materialName)} className="ml-1.5 flex-shrink-0 text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-100 focus:outline-none rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-700 p-0.5" aria-label={`Remove ${materialName}`}><span className="sr-only">Remove</span> &times;</button></span>))}
            </div>
            <div className="flex items-center gap-2 mt-1 w-full">
                <select id="selectMaterialToAdd" value={selectedMaterialToAdd} onChange={(e) => setSelectedMaterialToAdd(e.target.value)} disabled={isLoadingAvailableMaterials} className="flex-grow mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                    <option value="">{isLoadingAvailableMaterials ? "Loading materials..." : "-- Select an existing material --"}</option>
                    {availableMaterials.map(material => ( <option key={material.id} value={material.id}>{material.fileName} ({material.status})</option>))}
                </select>
                <button type="button" onClick={handleAddSelectedMaterialToForm} disabled={!selectedMaterialToAdd || isLoadingAvailableMaterials} className="mt-1 flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50" title="Add selected material to references"><PlusCircle size={16} className="mr-1.5"/> Add Selected</button>
            </div>
            <div className="flex items-center gap-2 mt-3 w-full">
                <input type="text" value={currentSourceMaterialText} onChange={(e) => setCurrentSourceMaterialText(e.target.value)} placeholder="Or add custom reference tag..." className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); handleAddCustomMaterialTag(); }}}/>
                <button type="button" onClick={handleAddCustomMaterialTag} className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Add Tag</button>
            </div>
        </div>

        {/* --- FORM SUBMIT BUTTONS --- */}
        <div className="flex justify-end space-x-3 pt-4">
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"><RefreshCcw size={16} className="mr-2" /> Reset</button>
            <button type="submit" disabled={isLoading || isUploadingSourceMaterial} className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">{isLoading ? 'Generating...' : (isUploadingSourceMaterial ? 'Uploading Source...' : 'Generate Results')}</button>
        </div>
      </form>

      {/* MODAL RENDERED HERE */}
      <ArchetypeRefinementModal
        isOpen={showArchetypeRefinementModal}
        onClose={() => setShowArchetypeRefinementModal(false)}
        definedArchetypes={samfordClientArchetypes} // Pass the Samford specific archetypes
        currentRefinements={formData.archetypeRefinements || {}}
        onApplyRefinements={handleApplyArchetypeRefinements}
      />

      {/* Display API Error for main content generation */}
      {apiError && (<div className="mt-8 p-4 border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30 rounded-lg shadow"><h3 className="text-md font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center"><AlertTriangle size={18} className="mr-2" />Error Generating Content</h3><p className="text-red-600 dark:text-red-200 text-sm">{apiError}</p></div>)}
      
      {/* Display Generated Content, Justification, and Image Recommendation Section */}
      {generatedData && !apiError && (
        <div className="mt-8 space-y-6">
          {generatedData.justification && (<div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow bg-slate-50 dark:bg-slate-800/60"><h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 flex items-center"><ThumbsUp size={18} className="mr-2 text-green-500 dark:text-green-400" />Result Justification</h3><p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{generatedData.justification}</p></div>)}
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Generated Content (Editable)</h3>
              <div className="flex space-x-2">
                <button onClick={() => { if(editableContent) { navigator.clipboard.writeText(editableContent).then(() => alert("Content copied!")).catch(err => console.error('Copy failed: ', err)); }}} className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded-md flex items-center" title="Copy generated text"><Copy size={14} className="mr-1.5" />Copy</button>
                <button onClick={() => alert("Export to be implemented.")} className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md flex items-center" title="Export content"><Download size={14} className="mr-1.5" />Export</button>
              </div>
            </div>
            <RichTextEditor initialContent={editableContent} onChange={(newContent) => { setEditableContent(newContent); }}/>
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 rounded-lg shadow bg-white dark:bg-gray-800 mt-6">
            <button
              type="button"
              onClick={handleFetchImageRecommendations}
              disabled={isLoadingRecommendations || !(editableContent && editableContent.trim())}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60 mb-4"
            >
              <ImageIconLucide size={18} className="mr-2" />
              {isLoadingRecommendations ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding Images...</> : 'Suggest Matching Images'}
            </button>

            {recommendationError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                <AlertTriangle className="inline mr-2 h-5 w-5"/>Error: {recommendationError}
              </div>
            )}
            
            {generalStatusMessage && generalStatusMessage.type === 'info' && generalStatusMessage.text.includes("No specific image recommendations") && (
                 <p className={`mt-2 text-sm p-2 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300`}>
                    {generalStatusMessage.text}
                 </p>
            )}

            {imageRecommendations && imageRecommendations.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-700 dark:text-white mb-3">Recommended Images:</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
                  {imageRecommendations.map(img => (
                    <div 
                        key={img.id} 
                        className="border rounded-lg overflow-hidden shadow-sm dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer group/imgitem relative" 
                        onClick={() => alert(`Selected image: ${img.fileName}\nURL: ${img.publicUrl || 'N/A'}`)}
                        title={`Click to select: ${img.fileName}\nDescription: ${img.aiGeneratedDescription || 'N/A'}`}
                    >
                      {img.publicUrl ? (
                        <div className="w-full h-32 relative block">
                          <NextImage 
                            src={img.publicUrl} 
                            alt={img.aiGeneratedDescription || img.fileName} 
                            layout="fill"
                            objectFit="cover" 
                            className="group-hover/imgitem:scale-105 transition-transform duration-300"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-32 flex items-center justify-center bg-gray-200 dark:bg-gray-600">
                          <ImageIconLucide className="h-12 w-12 text-gray-400" />
                        </div>
                      )}
                      <div className="p-2 bg-white/80 dark:bg-black/70 backdrop-blur-sm">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate" title={img.fileName}>{img.fileName}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 h-10 overflow-y-auto custom-scrollbar" title={img.aiGeneratedDescription || ""}> {/* Added custom-scrollbar */}
                            {img.aiGeneratedDescription ? (img.aiGeneratedDescription.substring(0, 45) + (img.aiGeneratedDescription.length > 45 ? '...' : '')) : 'No AI description'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}