// app/_components/marketing-content/ContentCreationForm.tsx
"use client";

import React, {
  useState,
  FormEvent,
  useEffect,
  useRef,
  ChangeEvent,
  KeyboardEvent,
} from "react";
import {
  Users,
  Type,
  Hash,
  Aperture,
  MessageSquareText,
  Paperclip,
  FolderSearch,
  Info,
  RefreshCcw,
  Settings2,
  Tags,
  Copy,
  Download,
  AlertTriangle,
  ThumbsUp,
  PlusCircle,
  Image as ImageIconLucide,
  Loader2,
  UploadCloud,
  Layers,
  Save,
} from "lucide-react";
import RichTextEditor from "@/app/_components/ui/RichTextEditor";
import NextImage from "next/image";
import ArchetypeRefinementModal from "./ArchetypeRefinementModal";
import { samfordClientArchetypes } from "./archetypeData";

// Interfaces
interface FormData {
  audience: string;
  mediaType: string;
  textCount: number;
  textCountUnit: "characters" | "words";
  dominantArchetype: string;
  archetypeRefinements: Record<string, number>;
  prompt: string;
  sourceMaterials: string[];
}

interface GeneratedData {
  generatedText: string;
  justification?: string;
}

interface ApiResponse {
  message: string;
  data?: GeneratedData;
  error?: string;
  debugInfo?: unknown;
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

interface SegmentedVariation {
  segmentTag: string;
  generatedText: string;
  justification?: string;
}

export default function ContentCreationForm() {
  // ... (rest of the component is unchanged) ...
  const initializeArchetypeRefinements = (): Record<string, number> => {
    const refinements: Record<string, number> = {};
    const archetypesToUse = samfordClientArchetypes || [];

    archetypesToUse.forEach((arch) => {
      refinements[arch.name] = 0;
    });

    const shepherd = archetypesToUse.find(
      (a) => a.name === "Loyal Shepherd"
    );
    const inspirer = archetypesToUse.find(
      (a) => a.name === "Classic Inspirer"
    );
    const leader = archetypesToUse.find(
      (a) => a.name === "Established Leader"
    );

    if (shepherd) refinements[shepherd.name] = 50;
    if (inspirer) refinements[inspirer.name] = 25;
    if (leader) refinements[leader.name] = 25;

    let currentSum = Object.values(refinements).reduce(
      (s, v) => s + (v || 0),
      0
    );

    if (currentSum !== 100 && archetypesToUse.length > 0) {
      const diff = 100 - currentSum;
      const primaryAdjust =
        archetypesToUse.find(
          (a) =>
            a.name === "Loyal Shepherd" &&
            (refinements[a.name] || 0) + diff >= 0
        ) ||
        archetypesToUse.find(
          (a) =>
            a.name === "Established Leader" &&
            (refinements[a.name] || 0) + diff >= 0
        ) ||
        archetypesToUse.find(
          (a) =>
            a.name === "Classic Inspirer" &&
            (refinements[a.name] || 0) + diff >= 0
        ) ||
        archetypesToUse.find(
          (a) =>
            (refinements[a.name] || 0) > 0 &&
            (refinements[a.name] || 0) + diff >= 0
        ) ||
        archetypesToUse[0];

      if (primaryAdjust) {
        refinements[primaryAdjust.name] =
          (refinements[primaryAdjust.name] || 0) + diff;
      }

      currentSum = Object.values(refinements).reduce(
        (s, v) => s + (v || 0),
        0
      );

      if (
        currentSum !== 100 &&
        archetypesToUse.length > 0 &&
        archetypesToUse[0]?.name
      ) {
        refinements[
          archetypesToUse[0].name
        ] = (refinements[archetypesToUse[0].name] || 0) + (100 - currentSum);
      }
    }

    return refinements;
  };

  // All useState calls are at the top level
  const [formData, setFormData] = useState<Partial<FormData>>({
    audience: "",
    mediaType: "",
    textCount: 100,
    textCountUnit: "characters",
    dominantArchetype:
      samfordClientArchetypes.find((arch) => arch.name === "Loyal Shepherd")
        ?.name || (samfordClientArchetypes.length > 0
        ? samfordClientArchetypes[0].name
        : ""),
    archetypeRefinements: initializeArchetypeRefinements(),
    prompt: "",
    sourceMaterials: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingHistory, setIsSavingHistory] = useState(false); // New state for saving history
  const [generatedData, setGeneratedData] =
    useState<GeneratedData | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [editableContent, setEditableContent] = useState<string>("");
  const [availableMaterials, setAvailableMaterials] = useState<
    AvailableSourceMaterial[]
  >([]);
  const [isLoadingAvailableMaterials, setIsLoadingAvailableMaterials] =
    useState(false);
  const [selectedMaterialToAdd, setSelectedMaterialToAdd] = useState<string>(
    ""
  );
  const [currentSourceMaterialText, setCurrentSourceMaterialText] =
    useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] =
    useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState<string>("");
  const [isUploadingSourceMaterial, setIsUploadingSourceMaterial] =
    useState<boolean>(false);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<
    string | null
  >(null);
  const [showArchetypeRefinementModal, setShowArchetypeRefinementModal] =
    useState(false);
  const [imageRecommendations, setImageRecommendations] = useState<
    RecommendedImage[] | null
  >(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] =
    useState<boolean>(false);
  const [recommendationError, setRecommendationError] = useState<
    string | null
  >(null);
  const [generalStatusMessage, setGeneralStatusMessage] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const [segmentationInput, setSegmentationInput] = useState<string>("");
  const [activeSegmentationTags, setActiveSegmentationTags] = useState<
    string[]
  >([]);
  const [isLoadingSegments, setIsLoadingSegments] = useState<boolean>(false);
  const [segmentedContent, setSegmentedContent] = useState<
    SegmentedVariation[] | null
  >(null);
  const [segmentationError, setSegmentationError] = useState<string | null>(
    null
  );
  const [editedSegmentedContent, setEditedSegmentedContent] = useState<
    Record<string, string>
  >({});

  // All useEffect calls are at the top level
  useEffect(() => {
    if (generatedData?.generatedText) {
      setEditableContent(generatedData.generatedText);
      setImageRecommendations(null);
      setRecommendationError(null);
      setSegmentedContent(null);
      setActiveSegmentationTags([]);
      setSegmentationInput("");
      setSegmentationError(null);
      setEditedSegmentedContent({});
    } else {
      setEditableContent("");
    }
  }, [generatedData]);

  useEffect(() => {
    if (segmentedContent && segmentedContent.length > 0) {
      const initialEdits: Record<string, string> = {};
      segmentedContent.forEach((variation) => {
        initialEdits[variation.segmentTag] = variation.generatedText;
      });
      setEditedSegmentedContent(initialEdits);
    } else {
      setEditedSegmentedContent({});
    }
  }, [segmentedContent]);

  useEffect(() => {
    const fetchIndexedMaterials = async () => {
      setIsLoadingAvailableMaterials(true);

      try {
        const response = await fetch("/api/source-materials?status=INDEXED");
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({
            message: "Failed to fetch indexed materials",
          }));
          throw new Error(errorData.message);
        }
        const data: AvailableSourceMaterial[] = await response.json();
        setAvailableMaterials(data);
      } catch (error) {
        console.error("Error fetching available materials:", error);
        setApiError(
          error instanceof Error
            ? error.message
            : "Failed to load source materials for selection."
        );
      } finally {
        setIsLoadingAvailableMaterials(false);
      }
    };

    fetchIndexedMaterials();
  }, []);

  // All handler functions are defined at the top level of the component
  const handleChange = (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTextCountChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      textCount: parseInt(event.target.value, 10) || 0,
    }));
  };

  const handleTextCountUnitChange = (
    event: ChangeEvent<HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      textCountUnit: event.target.value as FormData["textCountUnit"],
    }));
  };

  const handleApplyArchetypeRefinements = (
    newRefinements: Record<string, number>
  ) => {
    const finalRefinements: Record<string, number> = {};
    (samfordClientArchetypes || []).forEach((arch) => {
      finalRefinements[arch.name] = newRefinements[arch.name] || 0;
    });
    setFormData((prev) => ({
      ...prev!,
      archetypeRefinements: finalRefinements,
    }));

    let maxPercentage = -1;
    let newDominantArchetype =
      formData.dominantArchetype ||
      (samfordClientArchetypes.length > 0
        ? samfordClientArchetypes[0].name
        : "");

    Object.entries(finalRefinements).forEach(([name, percentage]) => {
      if (percentage > maxPercentage) {
        maxPercentage = percentage;
        newDominantArchetype = name;
      } else if (percentage === maxPercentage && percentage > 0) {
        if (
          name !== formData.dominantArchetype &&
          samfordClientArchetypes.find((a) => a.name === name)
        ) {
          newDominantArchetype = name;
        }
      }
    });

    if (
      maxPercentage >= 0 &&
      samfordClientArchetypes.find((a) => a.name === newDominantArchetype)
    ) {
      setFormData((prev) => ({
        ...prev!,
        dominantArchetype: newDominantArchetype,
      }));
    } else if (samfordClientArchetypes.length > 0) {
      setFormData((prev) => ({
        ...prev!,
        dominantArchetype: samfordClientArchetypes[0].name,
      }));
    } else {
      setFormData((prev) => ({ ...prev!, dominantArchetype: "" }));
    }
  };

  const handleAddSelectedMaterialToForm = () => {
    if (selectedMaterialToAdd) {
      const material = availableMaterials.find(
        (m) => m.id === selectedMaterialToAdd
      );
      if (
        material &&
        !formData.sourceMaterials?.includes(material.fileName)
      ) {
        setFormData((prev) => ({
          ...prev,
          sourceMaterials: [...(prev.sourceMaterials || []), material.fileName],
        }));
      }
      setSelectedMaterialToAdd("");
    }
  };

  const handleAddCustomMaterialTag = () => {
    if (
      currentSourceMaterialText.trim() &&
      !formData.sourceMaterials?.includes(currentSourceMaterialText.trim())
    ) {
      setFormData((prev) => ({
        ...prev,
        sourceMaterials: [
          ...(prev.sourceMaterials || []),
          currentSourceMaterialText.trim(),
        ],
      }));
      setCurrentSourceMaterialText("");
    }
  };

  const handleRemoveSourceMaterial = (materialToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      sourceMaterials:
        prev.sourceMaterials?.filter((m) => m !== materialToRemove),
    }));
  };

  const handleFileSelectForUpload = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFileForUpload(event.target.files[0]);
      setUploadStatusMessage(null);
    } else {
      setSelectedFileForUpload(null);
    }
  };

  const handleSourceMaterialUpload = async () => {
    if (!selectedFileForUpload) {
      setUploadStatusMessage("Error: Please select a file first.");
      return;
    }

    setIsUploadingSourceMaterial(true);
    setUploadStatusMessage(`Uploading "${selectedFileForUpload.name}"...`);

    const uploadFormDataObj = new FormData();
    uploadFormDataObj.append("file", selectedFileForUpload);
    if (fileDescription) {
      uploadFormDataObj.append("description", fileDescription);
    }

    try {
      const response = await fetch("/api/source-materials/upload", {
        method: "POST",
        body: uploadFormDataObj,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "File upload failed.");

      setUploadStatusMessage(`Success: "${result.sourceMaterial.fileName}" uploaded!`);
      setSelectedFileForUpload(null);
      setFileDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setUploadStatusMessage(
        `Error: ${error instanceof Error ? error.message : "Unknown upload error."}`
      );
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
    setSegmentedContent(null);
    setSegmentationError(null);
    setEditedSegmentedContent({});
    setGeneralStatusMessage(null);

    const payload = {
      ...formData,
      archetypeRefinements:
        formData.archetypeRefinements || initializeArchetypeRefinements(),
    };

    try {
      const response = await fetch("/api/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: ApiResponse = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || "Failed to generate content.");
      }

      if (result.data) {
        setGeneratedData(result.data);
      } else {
        setApiError("Received an unexpected response format from the server.");
      }
    } catch (error) {
      setApiError(
        error instanceof Error
          ? error.message
          : "An error occurred while generating content."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!generatedData) {
        setGeneralStatusMessage({ type: 'error', text: 'No content to save.' });
        return;
    }
    setIsSavingHistory(true);
    setGeneralStatusMessage({ type: 'info', text: 'Saving to history...' });

    try {
        const response = await fetch('/api/content-history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                promptText: formData.prompt,
                audience: formData.audience,
                mediaType: formData.mediaType,
                generatedBodyHtml: editableContent,
                justification: generatedData.justification,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save to history.');
        }
        setGeneralStatusMessage({ type: 'success', text: 'Content saved to history!' });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'An unknown error occurred.';
        setGeneralStatusMessage({ type: 'error', text: `Save failed: ${message}` });
    } finally {
        setIsSavingHistory(false);
        // Hide the message after a few seconds
        setTimeout(() => setGeneralStatusMessage(null), 4000);
    }
  };

  const handleFetchImageRecommendations = async () => {
    if (!editableContent && !generatedData?.generatedText) {
      setRecommendationError("Please generate text content first.");
      return;
    }

    setIsLoadingRecommendations(true);
    setImageRecommendations(null);
    setRecommendationError(null);
    setGeneralStatusMessage(null);

    const textToSearch = editableContent || generatedData?.generatedText || "";

    try {
      const response = await fetch("/api/images/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ textContent: textToSearch, topN: 3 }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Failed to fetch image recommendations."
        );
      }

      setImageRecommendations(result.recommendations || []);
      if (!result.recommendations || result.recommendations.length === 0) {
        setGeneralStatusMessage({
          type: "info",
          text: "No specific image recommendations found.",
        });
      }
    } catch (error) {
      setRecommendationError(
        error instanceof Error
          ? error.message
          : "Error fetching recommendations."
      );
    } finally {
      setIsLoadingRecommendations(false);
    }
  };

  const handleSegmentationInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSegmentationInput(event.target.value);
  };

  const addSegmentationTag = (tagToAdd: string) => {
    const newTag = tagToAdd.trim();
    if (newTag && !activeSegmentationTags.includes(newTag)) {
      setActiveSegmentationTags((prev) => [...prev, newTag]);
    }
  };

  const handleSegmentationInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "," || event.key === "Enter") {
      event.preventDefault();
      const tags = segmentationInput
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);
      tags.forEach((tag) => addSegmentationTag(tag));
      setSegmentationInput("");
    }
  };

  const removeSegmentationTag = (tagToRemove: string) => {
    setActiveSegmentationTags((prev) => prev.filter((tag) => tag !== tagToRemove));
  };

  const handleGenerateSegmentedContent = async () => {
    if (activeSegmentationTags.length === 0) {
      setSegmentationError("Please add at least one segment tag.");
      return;
    }

    const baseContentForSegmentation =
      editableContent.trim() || generatedData?.generatedText?.trim() || "";

    if (!baseContentForSegmentation) {
      setSegmentationError("Please generate base content first.");
      return;
    }

    setIsLoadingSegments(true);
    setSegmentedContent(null);
    setSegmentationError(null);
    setGeneralStatusMessage(null);

    try {
      const response = await fetch("/api/generate-segmented-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseContent: baseContentForSegmentation,
          segmentTags: activeSegmentationTags,
          originalPromptData: {
            audience: formData.audience,
            mediaType: formData.mediaType,
            archetypeRefinements: formData.archetypeRefinements,
            dominantArchetype: formData.dominantArchetype,
            prompt: formData.prompt,
          },
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || "Failed to generate segmented content."
        );
      }

      setSegmentedContent(result.segmentedVariations || []);
      if (!result.segmentedVariations || result.segmentedVariations.length === 0) {
        setGeneralStatusMessage({
          type: "info",
          text: "No segmented versions were generated.",
        });
      } else {
        setGeneralStatusMessage({
          type: "success",
          text: "Segmented content generated!",
        });
      }
    } catch (error) {
      setSegmentationError(
        error instanceof Error
          ? error.message
          : "An unknown error occurred during segmentation."
      );
    } finally {
      setIsLoadingSegments(false);
    }
  };

  const handleSegmentedContentChange = (segmentTag: string, newContent: string) => {
    setEditedSegmentedContent((prev) => ({
      ...prev,
      [segmentTag]: newContent,
    }));
  };

  const resetForm = () => {
    setFormData({
      audience: "",
      mediaType: "",
      textCount: 100,
      textCountUnit: "characters",
      dominantArchetype:
        samfordClientArchetypes.length > 0
          ? samfordClientArchetypes[0].name
          : "",
      archetypeRefinements: initializeArchetypeRefinements(),
      prompt: "",
      sourceMaterials: [],
    });
    setGeneratedData(null);
    setApiError(null);
    setSelectedFileForUpload(null);
    setUploadStatusMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setEditableContent("");
    setImageRecommendations(null);
    setRecommendationError(null);
    setGeneralStatusMessage(null);
    setSegmentationInput("");
    setActiveSegmentationTags([]);
    setSegmentedContent(null);
    setSegmentationError(null);
    setEditedSegmentedContent({});
  };

  const audienceOptions = [
    "Prospective Students",
    "Alumni",
    "Donors",
    "Campus Community",
    "Parents & Families",
  ];
  const mediaTypeOptions = [
    "Email Newsletter",
    "Social Media Post",
    "Blog Article",
    "Press Release",
    "Content/SEO",
  ];
  const textCountUnitOptions: FormData["textCountUnit"][] = [
    "characters",
    "words",
  ];
  const archetypeOptionsForDropdown = (samfordClientArchetypes || []).map(
    (arch) => arch.name
  );

  const LabelWithIcons = ({
    label,
    htmlFor,
    icon: IconComponent,
  }: {
    label: string;
    htmlFor?: string;
    icon: React.FC<React.SVGProps<SVGSVGElement>>;
  }) => (
    <label
      htmlFor={htmlFor}
      className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
    >
      <IconComponent
        size={18}
        className="mr-2 text-gray-500 dark:text-gray-400"
      />
      {label}
      <Info
        size={14}
        className="ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
        onClick={() => alert(`More information about ${label}`)}
      />
    </label>
  );

  // JSX Return statement starts here
  return (
    <div className="bg-white dark:bg-gray-800 p-6 md:p-8 shadow-xl rounded-lg">
      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-6">
        Hi {/* TODO: Get user's name */}, what do you want to say?
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Audience Selector */}
        <div>
          <LabelWithIcons label="Audience" htmlFor="audience" icon={Users} />
          <select
            id="audience"
            name="audience"
            value={formData.audience || ""}
            onChange={handleChange}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">Select Audience</option>
            {audienceOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Media Type Selector */}
        <div>
          <LabelWithIcons label="Media Type" htmlFor="mediaType" icon={Type} />
          <select
            id="mediaType"
            name="mediaType"
            value={formData.mediaType || ""}
            onChange={handleChange}
            required
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">Select Media Type</option>
            {mediaTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Text Count */}
        <div>
          <LabelWithIcons label="Text Count" htmlFor="textCount" icon={Hash} />
          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              id="textCount"
              name="textCount"
              value={formData.textCount || 0}
              onChange={handleTextCountChange}
              min={0}
              className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              placeholder="100"
            />
            <select
              id="textCountUnit"
              name="textCountUnit"
              value={formData.textCountUnit || "characters"}
              onChange={handleTextCountUnitChange}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              {textCountUnitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dominant Brand Archetype */}
        <div>
          <LabelWithIcons
            label="Dominant Brand Archetype"
            htmlFor="dominantArchetype"
            icon={Aperture}
          />
          <div className="flex items-center space-x-3">
            <select
              id="dominantArchetype"
              name="dominantArchetype"
              value={formData.dominantArchetype || ""}
              onChange={handleChange}
              required
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">Select Dominant Archetype</option>
              {archetypeOptionsForDropdown.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
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
            {formData.archetypeRefinements &&
              Object.entries(formData.archetypeRefinements)
                .filter(([, percentage]) => percentage > 0)
                .sort(([, a], [, b]) => b - a)
                .map(([name, percentage]) => (
                  <span
                    key={name}
                    className="inline-block bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-700 dark:text-gray-200"
                  >
                    {name}: {percentage}%
                  </span>
                ))}
          </div>
        </div>

        {/* Prompt & Attach Source */}
        <div>
          <LabelWithIcons
            label="Prompt (include instructions and purpose)"
            htmlFor="prompt"
            icon={MessageSquareText}
          />
          <textarea
            id="prompt"
            name="prompt"
            rows={4}
            value={formData.prompt || ""}
            onChange={handleChange}
            className="mt-1 block w-full px-3 py-2 border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
            placeholder="Create a virtual admissions event email..."
            required
          />
          <div className="mt-3 flex flex-wrap items-start gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelectForUpload}
              className="hidden"
              accept="application/pdf,.doc,.docx,.txt,.md"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Paperclip size={16} className="mr-2" /> Attach Source File
            </button>
            <button
              type="button"
              className="flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FolderSearch size={16} className="mr-2" /> Browse Prompts
            </button>
            {selectedFileForUpload && (
              <div className="w-full mt-2 p-3 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-md space-y-2 bg-indigo-50 dark:bg-indigo-900/30">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Selected:{" "}
                  <span className="font-medium">
                    {selectedFileForUpload.name}
                  </span>{" "}
                  ({(selectedFileForUpload.size / 1024).toFixed(2)} KB)
                </p>
                <input
                  type="text"
                  placeholder="Optional: File description"
                  value={fileDescription}
                  onChange={(e) => setFileDescription(e.target.value)}
                  className="block w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSourceMaterialUpload}
                  disabled={isUploadingSourceMaterial}
                  className="flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md disabled:opacity-60"
                >
                  <UploadCloud size={16} className="mr-2" />
                  {isUploadingSourceMaterial
                    ? "Uploading..."
                    : "Upload Selected File"}
                </button>
              </div>
            )}
            {uploadStatusMessage && (
              <p
                className={`w-full mt-2 text-sm font-medium p-2 rounded-md ${
                  uploadStatusMessage.startsWith("Error:")
                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                    : uploadStatusMessage.startsWith("Success:")
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                }`}
              >
                {uploadStatusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Reference Source Materials */}
        <div>
          <LabelWithIcons
            label="Reference Source Material(s)"
            htmlFor="sourceMaterials"
            icon={Tags}
          />
          <div className="flex flex-wrap gap-2 my-2 min-h-[20px]">
            {formData.sourceMaterials?.map((materialName) => (
              <span
                key={materialName}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
              >
                {materialName}
                <button
                  type="button"
                  onClick={() => handleRemoveSourceMaterial(materialName)}
                  className="ml-1.5 flex-shrink-0 text-indigo-500 hover:text-indigo-700 dark:text-indigo-300 dark:hover:text-indigo-100 focus:outline-none rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-700 p-0.5"
                  aria-label={`Remove ${materialName}`}
                >
                  <span className="sr-only">Remove</span> ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-1 w-full">
            <select
              id="selectMaterialToAdd"
              value={selectedMaterialToAdd}
              onChange={(e) => setSelectedMaterialToAdd(e.target.value)}
              disabled={isLoadingAvailableMaterials}
              className="flex-grow mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="">
                {isLoadingAvailableMaterials
                  ? "Loading materials..."
                  : "-- Select an existing material --"}
              </option>
              {availableMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.fileName} ({material.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddSelectedMaterialToForm}
              disabled={!selectedMaterialToAdd || isLoadingAvailableMaterials}
              className="mt-1 flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              title="Add selected material to references"
            >
              <PlusCircle size={16} className="mr-1.5" /> Add Selected
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3 w-full">
            <input
              type="text"
              value={currentSourceMaterialText}
              onChange={(e) => setCurrentSourceMaterialText(e.target.value)}
              placeholder="Or add custom reference tag..."
              className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddCustomMaterialTag();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddCustomMaterialTag}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Add Tag
            </button>
          </div>
        </div>

        {/* Form Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center"
          >
            <RefreshCcw size={16} className="mr-2" /> Reset
          </button>
          <button
            type="submit"
            disabled={isLoading || isUploadingSourceMaterial}
            className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {isLoading
              ? "Generating..."
              : isUploadingSourceMaterial
              ? "Uploading Source..."
              : "Generate Results"}
          </button>
        </div>
      </form>

      {/* Archetype Refinement Modal */}
      <ArchetypeRefinementModal
        isOpen={showArchetypeRefinementModal}
        onClose={() => setShowArchetypeRefinementModal(false)}
        definedArchetypes={samfordClientArchetypes}
        currentRefinements={formData.archetypeRefinements || {}}
        onApplyRefinements={handleApplyArchetypeRefinements}
      />

      {/* Display API Error for main content generation */}
      {apiError && (
        <div className="mt-8 p-4 border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30 rounded-lg shadow">
          <h3 className="text-md font-semibold text-red-700 dark:text-red-300 mb-2 flex items-center">
            <AlertTriangle size={18} className="mr-2" />
            Error Generating Content
          </h3>
          <p className="text-red-600 dark:text-red-200 text-sm">{apiError}</p>
        </div>
      )}

      {/* General Status Message */}
      {generalStatusMessage && (
        <div className={`mt-4 p-3 rounded-md text-sm font-medium ${
            generalStatusMessage.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : 
            generalStatusMessage.type === 'success' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 
            'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
        }`}>
          {generalStatusMessage.text}
        </div>
      )}
      
      {/* Display Generated Content, Justification, Segmentation, and Image Recommendation Section */}
      {generatedData && !apiError && (
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700 space-y-6">
          {/* Result Justification Section */}
          {generatedData.justification && (
            <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg shadow bg-slate-50 dark:bg-slate-800/60">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2 flex items-center">
                <ThumbsUp
                  size={18}
                  className="mr-2 text-green-500 dark:text-green-400"
                />
                Result Justification
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                {generatedData.justification}
              </p>
            </div>
          )}

          {/* Main Generated Content Section with RichTextEditor */}
          <div className="p-4 border rounded-lg shadow bg-white dark:bg-gray-800">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Generated Content (Editable)
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handleSaveToHistory}
                  disabled={isSavingHistory}
                  className="px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-900 rounded-md flex items-center disabled:opacity-50"
                  title="Save to history"
                >
                  {isSavingHistory ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Save size={14} className="mr-1.5" />}
                  {isSavingHistory ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => {
                    if (editableContent) {
                      navigator.clipboard
                        .writeText(editableContent)
                        .then(() => setGeneralStatusMessage({ type: 'success', text: 'Content copied!' }))
                        .catch((err) =>
                          console.error("Copy failed: ", err)
                        );
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded-md flex items-center"
                  title="Copy generated text"
                >
                  <Copy size={14} className="mr-1.5" />
                  Copy
                </button>
                <button
                  onClick={() => alert("Export to be implemented.")}
                  className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md flex items-center"
                  title="Export content"
                >
                  <Download size={14} className="mr-1.5" />
                  Export
                </button>
              </div>
            </div>
            <RichTextEditor
              initialContent={editableContent}
              onChange={(newContent) => {
                setEditableContent(newContent);
              }}
            />
          </div>

          {/* Create Version Segmentations Section */}
          <div className="p-4 border-t dark:border-gray-700 rounded-lg shadow bg-slate-50 dark:bg-gray-800/60 mt-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3 flex items-center">
              <Layers size={20} className="mr-2 text-indigo-600 dark:text-indigo-400" />
              Create Version Segmentations
              <Info
                size={14}
                className="ml-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                onClick={() =>
                  alert(
                    'Define segments (e.g., "In-State", "Out-of-State", "Athlete") to generate tailored versions of the content above.'
                  )
                }
              />
            </h3>
            <div className="mb-3">
              <label htmlFor="segmentationInput" className="sr-only">
                Add segment tags (comma-separated)
              </label>
              <input
                type="text"
                id="segmentationInput"
                value={segmentationInput}
                onChange={handleSegmentationInputChange}
                onKeyDown={handleSegmentationInputKeyDown}
                placeholder="Type segment(s), press Enter or comma to add..."
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:text-white"
              />
            </div>
            {activeSegmentationTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {activeSegmentationTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeSegmentationTag(tag)}
                      className="ml-1.5 flex-shrink-0 text-sky-500 hover:text-sky-700 dark:text-sky-300 dark:hover:text-sky-100 focus:outline-none rounded-full hover:bg-sky-200 dark:hover:bg-sky-700 p-0.5"
                      aria-label={`Remove ${tag}`}
                    >
                      <span className="sr-only">Remove</span> ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={handleGenerateSegmentedContent}
              disabled={isLoadingSegments || activeSegmentationTags.length === 0}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60"
            >
              {isLoadingSegments ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating
                  Segments...
                </>
              ) : (
                "Generate Segmented Content"
              )}
            </button>
            {segmentationError && (
              <div className="mt-3 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                <AlertTriangle className="inline mr-2 h-5 w-5" />
                Error: {segmentationError}
              </div>
            )}
          </div>

          {/* Display Segmented Content Variations */}
          {segmentedContent && segmentedContent.length > 0 && (
            <div className="mt-6 space-y-4">
              <h4 className="text-md font-semibold text-gray-700 dark:text-white">
                Segmented Content Variations:
              </h4>
              {segmentedContent.map((variation, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg shadow bg-white dark:bg-gray-800"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h5 className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {variation.segmentTag} Version
                    </h5>
                    {/* TODO: Add Copy/Export buttons for each segment if needed */}
                  </div>
                  {variation.justification && (
                    <p className="text-xs italic text-gray-500 dark:text-gray-400 mb-2">
                      Justification: {variation.justification}
                    </p>
                  )}
                  <RichTextEditor
                    initialContent={
                      editedSegmentedContent[variation.segmentTag] ||
                      variation.generatedText
                    }
                    onChange={(newContent) =>
                      handleSegmentedContentChange(
                        variation.segmentTag,
                        newContent
                      )
                    }
                    editable={true}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Image Recommendations Section */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 rounded-lg shadow bg-white dark:bg-gray-800 mt-6">
            <button
              type="button"
              onClick={handleFetchImageRecommendations}
              disabled={
                isLoadingRecommendations ||
                !(editableContent && editableContent.trim())
              }
              className="w-full sm:w-auto flex items-center justify-center px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-medium rounded-md shadow-sm disabled:opacity-60 mb-4"
            >
              <ImageIconLucide size={18} className="mr-2" />
              {isLoadingRecommendations ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finding
                  Images...
                </>
              ) : (
                "Suggest Matching Images"
              )}
            </button>

            {recommendationError && (
              <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">
                <AlertTriangle className="inline mr-2 h-5 w-5" />
                Error: {recommendationError}
              </div>
            )}
            {generalStatusMessage &&
              generalStatusMessage.type === "info" &&
              generalStatusMessage.text.includes(
                "No specific image recommendations"
              ) && (
                <p className="mt-2 text-sm p-2 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {generalStatusMessage.text}
                </p>
              )}
            {imageRecommendations && imageRecommendations.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-700 dark:text-white mb-3">
                  Recommended Images:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4">
                  {imageRecommendations.map((img) => (
                    <div
                      key={img.id}
                      className="border rounded-lg overflow-hidden shadow-sm dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer group/imgitem relative"
                      onClick={() =>
                        alert(
                          `Selected image: ${img.fileName}\nURL: ${
                            img.publicUrl || "N/A"
                          }`
                        )
                      }
                      title={`Click to select: ${img.fileName}\nDescription: ${
                        img.aiGeneratedDescription || "N/A"
                      }`}
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
                        <p
                          className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate"
                          title={img.fileName}
                        >
                          {img.fileName}
                        </p>
                        <p
                          className="text-xs text-gray-600 dark:text-gray-300 h-10 overflow-y-auto custom-scrollbar"
                          title={img.aiGeneratedDescription || ""}
                        >
                          {img.aiGeneratedDescription
                            ? img.aiGeneratedDescription.substring(0, 45) +
                              (img.aiGeneratedDescription.length > 45 ? "..." : "")
                            : "No AI description"}
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