"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import {
  Aperture,
  Info,
  Paperclip,
  FolderSearch,
} from "lucide-react";
import { samfordClientArchetypes } from "./archetypeData";

// ... (interfaces and state remain unchanged)

export default function ContentCreationForm() {
    const [formData, setFormData] = useState({
        audience: '',
        mediaType: '',
        textCount: 100,
        textCountUnit: 'characters',
        dominantArchetype: '',
        prompt: '',
        sourceMaterials: [],
    });

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleTextCountChange = (e: ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, textCount: parseInt(e.target.value, 10) || 0 }));
    };

    const handleTextCountUnitChange = (e: ChangeEvent<HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, textCountUnit: e.target.value as 'characters' | 'words' }));
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        // Handle form submission
    };


  // --- UI ---
  return (
    <div className="bg-[#112D36] p-6 md:p-8 shadow-xl rounded-lg">
      <h2 className="text-xl sm:text-2xl font-heading text-chemgen-light mb-6">
        Hi, what do you want to create?
      </h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Each input on its own row, matching the design */}
        <div className="space-y-6">
          <div>
            <label htmlFor="audience" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
              Audience <Info size={16} className="ml-1 text-cyan-300" />
            </label>
            <select
              id="audience"
              name="audience"
              value={formData.audience || ""}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
            >
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
            <select
              id="mediaType"
              name="mediaType"
              value={formData.mediaType || ""}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
            >
              <option value="">Select Media Type</option>
              {["Email Newsletter", "Social Media Post", "Blog Article", "Press Release", "Content/SEO"].map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="textCount" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
              Text Count <Info size={16} className="ml-1 text-cyan-300" />
            </label>
            <div className="flex gap-3">
              <input
                type="number"
                id="textCount"
                name="textCount"
                value={formData.textCount || 0}
                onChange={handleTextCountChange}
                min={0}
                className="w-1/2 px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
                placeholder="100"
              />
              <select
                id="textCountUnit"
                name="textCountUnit"
                value={formData.textCountUnit || "characters"}
                onChange={handleTextCountUnitChange}
                className="w-1/2 px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
              >
                <option value="characters">Characters</option>
                <option value="words">Words</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="dominantArchetype" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
              Dominant Brand Archetype <Info size={16} className="ml-1 text-cyan-300" />
            </label>
            <div className="flex gap-3">
              <select
                id="dominantArchetype"
                name="dominantArchetype"
                value={formData.dominantArchetype || ""}
                onChange={handleChange}
                required
                className="flex-1 px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
              >
                <option value="">Select Archetype</option>
                {samfordClientArchetypes.map((arch) => (
                  <option key={arch.name} value={arch.name}>{arch.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-normal hover:bg-[#18313A] focus:ring-2 focus:ring-cyan-400"
                onClick={() => alert("Refine archetype mix (modal coming soon)")}
              >
                Refine <Aperture size={16} className="inline ml-1" />
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="prompt" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
              Prompt (include instructions and purpose) <Info size={16} className="ml-1 text-cyan-300" />
            </label>
            <textarea
              id="prompt"
              name="prompt"
              rows={3}
              value={formData.prompt || ""}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] text-chemgen-light font-body font-light focus:ring-2 focus:ring-cyan-400"
              placeholder="Create a virtual admissions event email..."
              required
            />
            <div className="flex gap-3 mt-2">
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-md border border-[#2A3B3F] bg-[#18313A] text-chemgen-light font-body font-normal opacity-60 cursor-not-allowed"
                disabled
              >
                <Paperclip size={16} className="inline mr-2" /> Attach
              </button>
              <button
                type="button"
                className="flex-1 px-4 py-2 rounded-md border border-[#2A3B3F] bg-[#18313A] text-chemgen-light font-body font-normal opacity-60 cursor-not-allowed"
                disabled
              >
                <FolderSearch size={16} className="inline mr-2" /> Browse Prompts
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="sourceMaterials" className="flex items-center text-sm font-heading text-chemgen-light mb-1">
              Reference the Following Source Material(s) <Info size={16} className="ml-1 text-cyan-300" />
            </label>
            <div className="w-full px-4 py-3 rounded-md border border-[#2A3B3F] bg-[#0B232A] flex flex-wrap gap-2">
              {/* Example tags, replace with dynamic tags as needed */}
              <span className="bg-[#18313A] text-chemgen-light px-3 py-1 rounded-full text-xs font-body font-normal">2025 Viewbook</span>
              <span className="bg-[#18313A] text-chemgen-light px-3 py-1 rounded-full text-xs font-body font-normal">2025 Campaign</span>
              <span className="bg-[#18313A] text-chemgen-light px-3 py-1 rounded-full text-xs font-body font-normal opacity-60">Storyline 3</span>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            className="px-6 py-3 rounded-md border border-[#2A3B3F] bg-[#18313A] text-chemgen-light font-body font-normal opacity-60 cursor-not-allowed"
            disabled
          >
            Reset
          </button>
          <button
            type="submit"
            className="px-6 py-3 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white font-body font-normal"
          >
            Generate Results
          </button>
        </div>
      </form>
    </div>
  );
}