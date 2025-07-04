"use client";

import React, { useState, FormEvent, useEffect, ChangeEvent, KeyboardEvent, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Aperture, Paperclip, FolderSearch, Info,
  Copy, Download, PlusCircle, Loader2,
  Layers, Save, PenSquare
} from "lucide-react";
import RichTextEditor from "@/app/_components/ui/RichTextEditor";
import NextImage from "next/image";
import { samfordClientArchetypes } from "@/app/_components/marketing-content/archetypeData";
import ArchetypeRefinementModal from "@/app/_components/marketing-content/ArchetypeRefinementModal";


// --- Interfaces ---
interface FormData {
  audience: string;
  mediaType: string;
  textCount: number;
  textCountUnit: 'characters' | 'words';
  dominantArchetype: string;
  prompt: string;
  sourceMaterialIds: string[];
  archetypeRefinements: Record<string, number>;
}

interface SourceMaterial {
  id: string;
  fileName: string;
}

interface GenerationResult {
  generatedText: string;
  justification: string;
}

interface ImageRecommendation {
  id: string;
  publicUrl: string | null;
  fileName: string;
}

interface SegmentedVariation {
  segmentTag: string;
  generatedText: string;
}

// --- Component ---
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Form State
  const [formData, setFormData] = useState<FormData>({
    audience: "",
    mediaType: "",
    textCount: 150,
    textCountUnit: "words",
    dominantArchetype: "",
    prompt: "",
    sourceMaterialIds: [],
    archetypeRefinements: {},
  });
  const [availableMaterials, setAvailableMaterials] = useState<SourceMaterial[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Result State
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [imageRecommendations, setImageRecommendations] = useState<ImageRecommendation[]>([]);
  const [segmentedVariations, setSegmentedVariations] = useState<SegmentedVariation[]>([]);
  const [segmentTags, setSegmentTags] = useState<string[]>([]);
  const newSegmentTagRef = useRef<HTMLInputElement>(null);

  // Revision State
  const [revisingId, setRevisingId] = useState<string | null>(null); // 'main' or segmentTag
  const [revisionInstructions, setRevisionInstructions] = useState("");


  // Loading and Status State
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [isFetchingImages, setIsFetchingImages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmittingRevision, setIsSubmittingRevision] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/source-materials?status=INDEXED');
      if (response.ok) {
        const data = await response.json();
        setAvailableMaterials(data);
      } else {
        console.error("Failed to fetch source materials");
      }
    } catch (error) {
      console.error("Error fetching source materials:", error);
    }
  };

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace('/login');
    }
    fetchMaterials();
  }, [status, router]);

  // --- Handlers ---
  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleMaterialSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({
        ...prev,
        sourceMaterialIds: selectedOptions,
    }));
  };
  
  const handleApplyRefinements = (newRefinements: Record<string, number>) => {
    setFormData(prev => ({ ...prev, archetypeRefinements: newRefinements }));
  };
  
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileAttached = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setSuccessMessage(null);
    setError(null);

    const uploadFormData = new FormData();
    uploadFormData.append('file', file);

    try {
        const response = await fetch('/api/source-materials/upload', {
            method: 'POST',
            body: uploadFormData,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "File upload failed.");
        setSuccessMessage(`Successfully uploaded "${file.name}"!`);
        await fetchMaterials(); // Refresh the list
    } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
        setIsUploading(false);
        if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setResult(null);
    setImageRecommendations([]);
    setSegmentedVariations([]);

    try {
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Content generation failed.");

      setResult(data.data);
      setEditedContent(data.data.generatedText);
      await fetchImageRecommendations(data.data.generatedText);

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchImageRecommendations = async (textContent: string) => {
    setIsFetchingImages(true);
    try {
        const response = await fetch('/api/images/recommendations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ textContent }),
        });
        const data = await response.json();
        if(response.ok) {
            setImageRecommendations(data.recommendations);
        }
    } catch (error) {
        console.error("Failed to fetch image recommendations", error);
    } finally {
        setIsFetchingImages(false);
    }
  };


  const handleSave = async (contentToSave: string) => {
    if (!result) return;
    setIsSaving(true);
    setSuccessMessage(null);
    setError(null);
    try {
        const payload = {
            promptText: formData.prompt,
            audience: formData.audience,
            mediaType: formData.mediaType,
            generatedBodyHtml: contentToSave,
            justification: result.justification,
        }
        const response = await fetch('/api/content-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if(!response.ok) throw new Error("Failed to save to history.");
        setSuccessMessage("Successfully saved to history!");
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save to history.');
    } finally {
        setIsSaving(false);
    }
  };

  const handleCopyToClipboard = (textToCopy: string) => {
    navigator.clipboard.writeText(textToCopy)
        .then(() => setSuccessMessage("Content copied to clipboard!"))
        .catch(() => setError("Failed to copy content."));
  };

    const handleAddSegmentTag = () => {
        if (newSegmentTagRef.current) {
            const newTag = newSegmentTagRef.current.value.trim();
            if (newTag && !segmentTags.includes(newTag)) {
                setSegmentTags([...segmentTags, newTag]);
            }
            newSegmentTagRef.current.value = ""; // Clear input
        }
    };

    const handleSegmentTagKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSegmentTag();
        }
    };


  const handleSegmentation = async () => {
    if(segmentTags.length === 0) {
        setError("Please add at least one segment tag.");
        return;
    }
    setIsSegmenting(true);
    setError(null);
    try {
        const response = await fetch('/api/generate-segmented-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ baseContent: editedContent, segmentTags, originalPromptData: formData })
        });
        const data = await response.json();
        if(!response.ok) throw new Error(data.message || "Failed to generate segments.");
        setSegmentedVariations(data.segmentedVariations);
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not generate segments.');
    } finally {
        setIsSegmenting(false);
    }
  };
  
    const handleRevisionSubmit = async () => {
        if (!revisingId || !revisionInstructions) {
            setError("Revision instructions cannot be empty.");
            return;
        }

        setIsSubmittingRevision(true);
        setError(null);

        try {
            let originalContent = "";
            if (revisingId === 'main') {
                originalContent = editedContent;
            } else {
                const variation = segmentedVariations.find(v => v.segmentTag === revisingId);
                if (variation) originalContent = variation.generatedText;
            }

            if (!originalContent) throw new Error("Could not find original content to revise.");

            const response = await fetch('/api/revise-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalContent, revisionInstructions }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || "Revision failed.");

            // Update the correct piece of state
            if (revisingId === 'main') {
                setEditedContent(data.revisedContent);
                // Also update the main result to keep them in sync if needed
                setResult(prev => prev ? { ...prev, generatedText: data.revisedContent } : null);
            } else {
                setSegmentedVariations(prev =>
                    prev.map(v => v.segmentTag === revisingId ? { ...v, generatedText: data.revisedContent } : v)
                );
            }

            setSuccessMessage("Content revised successfully!");
            // Close the revision UI
            setRevisingId(null);
            setRevisionInstructions("");

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred during revision.');
        } finally {
            setIsSubmittingRevision(false);
        }
    };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <ArchetypeRefinementModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            definedArchetypes={samfordClientArchetypes}
            currentRefinements={formData.archetypeRefinements}
            onApplyRefinements={handleApplyRefinements}
        />
       <div className="bg-[#112D36] p-6 md:p-8 shadow-xl rounded-lg">
            <div className="flex flex-wrap justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-heading text-chemgen-light">
                Welcome, {session?.user?.name || session?.user?.email || "User"}!
                </h1>
                <button
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="px-5 py-2.5 bg-[#18313A] hover:bg-[#1B3A44] text-chemgen-light font-body font-normal rounded-md shadow-md focus:outline-none focus:ring-2 focus:ring-cyan-400 mt-4 sm:mt-0"
                >
                Sign Out
                </button>
            </div>
            <p className="text-chemgen-light font-body font-light mb-6">
                Use the form below to generate your marketing content.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <label htmlFor="audience" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
                    Audience <Info size={16} className="ml-1 text-cyan-300" />
                    </label>
                    <select id="audience" name="audience" value={formData.audience || ""} onChange={handleChange} required
                    className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400">
                    <option value="">Select Audience</option>
                    {["Prospective Students", "Alumni", "Donors", "Campus Community", "Parents & Families"].map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                    </select>
                </div>
                 <div>
                    <label htmlFor="mediaType" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
                    Media Type <Info size={16} className="ml-1 text-cyan-300" />
                    </label>
                    <select id="mediaType" name="mediaType" value={formData.mediaType || ""} onChange={handleChange} required
                    className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400">
                    <option value="">Select Media Type</option>
                    {["Email Newsletter", "Social Media Post", "Blog Article", "Press Release", "Content/SEO"].map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="dominantArchetype" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
                    Dominant Brand Archetype <Info size={16} className="ml-1 text-cyan-300" />
                    </label>
                    <div className="flex gap-3">
                    <select id="dominantArchetype" name="dominantArchetype" value={formData.dominantArchetype || ""} onChange={handleChange} required
                        className="flex-1 px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400">
                        <option value="">Select Archetype</option>
                        {samfordClientArchetypes.map((arch) => (
                        <option key={arch.name} value={arch.name}>{arch.name}</option>
                        ))}
                    </select>
                    <button type="button"
                        className="px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-normal hover:bg-[#18313A] focus:ring-2 focus:ring-cyan-400"
                        onClick={() => setIsModalOpen(true)}>
                        Refine <Aperture size={16} className="inline ml-1" />
                    </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="prompt" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
                        Prompt (include instructions and purpose) <Info size={16} className="ml-1 text-cyan-300" />
                    </label>
                    <textarea id="prompt" name="prompt" rows={3} value={formData.prompt || ""} onChange={handleChange}
                        className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
                        placeholder="Create a virtual admissions event email..." required/>
                    <div className="flex gap-3 mt-2">
                        <input type="file" ref={fileInputRef} onChange={handleFileAttached} className="hidden" />
                        <button type="button" onClick={handleAttachClick} disabled={isUploading}
                            className="flex-1 px-4 py-2 rounded-md border border-[#2A3B3F] bg-[#18313A] text-chemgen-light font-body font-normal hover:bg-[#1B3A44] disabled:opacity-50">
                            {isUploading ? <Loader2 size={16} className="animate-spin inline mr-2" /> : <Paperclip size={16} className="inline mr-2" />}
                             Attach
                        </button>
                        <button type="button" onClick={() => alert("Browse Prompts functionality to be implemented.")}
                            className="flex-1 px-4 py-2 rounded-md border border-[#2A3B3F] bg-[#18313A] text-chemgen-light font-body font-normal hover:bg-[#1B3A44]">
                            <FolderSearch size={16} className="inline mr-2" /> Browse Prompts
                        </button>
                    </div>
                </div>
                <div>
                    <label htmlFor="sourceMaterials" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
                        Reference Source Material(s) <Info size={16} className="ml-1 text-cyan-300" />
                    </label>
                    <select
                        multiple
                        id="sourceMaterials"
                        name="sourceMaterialIds"
                        value={formData.sourceMaterialIds}
                        onChange={handleMaterialSelectChange}
                        className="w-full h-32 px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
                    >
                        {availableMaterials.length > 0 ? (
                            availableMaterials.map(material => (
                                <option key={material.id} value={material.id}>
                                    {material.fileName}
                                </option>
                            ))
                        ) : (
                            <option disabled>No indexed materials found.</option>
                        )}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Hold Ctrl (or Cmd on Mac) to select multiple materials.</p>
                </div>
                <div className="flex justify-end pt-4">
                <button type="submit" disabled={isLoading} className="px-8 py-3 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-body font-semibold flex items-center justify-center min-w-[150px]">
                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : "Generate Results"}
                </button>
                </div>
            </form>
      </div>

        {/* Results Section */}
        {error && <div className="p-4 my-4 bg-red-900/30 text-red-300 rounded-md">{error}</div>}
        {successMessage && <div className="p-4 my-4 bg-green-900/30 text-green-300 rounded-md">{successMessage}</div>}

        {result && (
            <div className="space-y-8 mt-8">
                {/* Main Content & Justification */}
                <div className="bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                    <h3 className="text-xl font-bold text-white mb-4">Generated Content</h3>
                    <RichTextEditor initialContent={result.generatedText} onChange={setEditedContent} />

                     <div className="mt-4 p-4 bg-gray-700/50 rounded-md">
                        <h4 className="font-semibold text-gray-200">Justification</h4>
                        <p className="text-sm text-gray-300 mt-1">{result.justification}</p>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                        <button onClick={() => handleSave(editedContent)} disabled={isSaving} className="flex items-center px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 rounded-md text-white disabled:opacity-50">
                            {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>} Save to History
                        </button>
                        <button onClick={() => handleCopyToClipboard(editedContent)} className="flex items-center px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md text-white">
                            <Copy className="mr-2"/> Copy
                        </button>
                         <button onClick={() => alert("Export functionality coming soon!")} className="flex items-center px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 rounded-md text-white">
                            <Download className="mr-2"/> Export
                        </button>
                        <button onClick={() => setRevisingId('main')} className="flex items-center px-4 py-2 text-sm bg-purple-600 hover:bg-purple-700 rounded-md text-white">
                            <PenSquare className="mr-2"/> Revise
                        </button>
                    </div>
                    
                    {revisingId === 'main' && (
                        <div className="mt-4 p-4 border-t border-gray-700">
                            <h4 className="font-semibold text-white mb-2">Revision Instructions</h4>
                            <textarea
                                value={revisionInstructions}
                                onChange={(e) => setRevisionInstructions(e.target.value)}
                                className="w-full px-3 py-2 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light"
                                rows={3}
                                placeholder="e.g., 'Make the tone more formal', 'Add a call to action to visit the website'"
                            />
                            <div className="flex justify-end gap-3 mt-2">
                                <button onClick={() => setRevisingId(null)} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-md">Cancel</button>
                                <button onClick={handleRevisionSubmit} disabled={isSubmittingRevision} className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-md disabled:opacity-50">
                                    {isSubmittingRevision ? <Loader2 className="animate-spin"/> : "Submit Revision"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Image Recommendations */}
                <div className="bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                     <h3 className="text-xl font-bold text-white mb-4">Image Recommendations</h3>
                     {isFetchingImages ? <Loader2 className="animate-spin"/> : (
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                             {imageRecommendations.map(img => (
                                 <div key={img.id} className="relative aspect-square border-2 border-transparent hover:border-cyan-400 rounded-md overflow-hidden cursor-pointer">
                                     {img.publicUrl && <NextImage src={img.publicUrl} alt={img.fileName} layout="fill" className="object-cover"/>}
                                 </div>
                             ))}
                         </div>
                     )}
                </div>

                {/* Segmentation */}
                <div className="bg-gray-800 shadow-xl rounded-lg p-6 md:p-8">
                    <h3 className="text-xl font-bold text-white mb-4">Create Segmented Versions</h3>
                     <div className="flex gap-2 mb-4">
                        <input ref={newSegmentTagRef} onKeyPress={handleSegmentTagKeyPress} type="text" placeholder="e.g., In-State Students" className="flex-grow px-3 py-2 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light"/>
                        <button onClick={handleAddSegmentTag} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-white"><PlusCircle/></button>
                    </div>
                     <div className="flex flex-wrap gap-2 mb-4">
                        {segmentTags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-gray-700 rounded-full text-sm text-gray-200">{tag}</span>
                        ))}
                    </div>
                    <button onClick={handleSegmentation} disabled={isSegmenting} className="flex items-center px-4 py-2 text-sm bg-green-600 hover:bg-green-700 rounded-md text-white disabled:opacity-50">
                         {isSegmenting ? <Loader2 className="animate-spin mr-2"/> : <Layers className="mr-2"/>} Generate Segments
                    </button>

                    {segmentedVariations.length > 0 && (
                        <div className="mt-6 space-y-4">
                            {segmentedVariations.map(variation => (
                                <div key={variation.segmentTag} className="p-4 bg-gray-700/50 rounded-md border border-gray-700">
                                    <h4 className="font-bold text-cyan-400">{variation.segmentTag}</h4>
                                    <p className="mt-2 text-gray-300 whitespace-pre-wrap">{variation.generatedText}</p>
                                    
                                    <div className="mt-4 pt-4 border-t border-gray-600 flex flex-wrap gap-3">
                                        <button onClick={() => handleSave(variation.generatedText)} className="flex items-center px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 rounded-md text-white"><Save size={14} className="mr-1.5"/> Save</button>
                                        <button onClick={() => handleCopyToClipboard(variation.generatedText)} className="flex items-center px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 rounded-md text-white"><Copy size={14} className="mr-1.5"/> Copy</button>
                                        <button onClick={() => alert("Export functionality coming soon!")} className="flex items-center px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-700 rounded-md text-white"><Download size={14} className="mr-1.5"/> Export</button>
                                        <button onClick={() => setRevisingId(variation.segmentTag)} className="flex items-center px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 rounded-md text-white"><PenSquare size={14} className="mr-1.5"/> Revise</button>
                                    </div>
                                    
                                    {revisingId === variation.segmentTag && (
                                        <div className="mt-4">
                                            <textarea
                                                defaultValue={variation.generatedText}
                                                onChange={(e) => setRevisionInstructions(e.target.value)}
                                                className="w-full px-3 py-2 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light text-sm"
                                                rows={3}
                                                placeholder="Instructions to revise this segmented version..."
                                            />
                                            <div className="flex justify-end gap-3 mt-2">
                                                <button onClick={() => setRevisingId(null)} className="px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 rounded-md">Cancel</button>
                                                <button onClick={handleRevisionSubmit} disabled={isSubmittingRevision} className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-md disabled:opacity-50">
                                                    {isSubmittingRevision ? <Loader2 className="animate-spin"/> : "Submit Revision"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}
    </div>
  );
}