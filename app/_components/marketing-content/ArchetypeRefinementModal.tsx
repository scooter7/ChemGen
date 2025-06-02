// app/_components/marketing-content/ArchetypeRefinementModal.tsx
"use client";

import React, { useState, useEffect, ChangeEvent } from 'react';
import { X } from 'lucide-react';
import { type Archetype } from './archetypeData'; // Import from the file created above

interface ArchetypeRefinementModalProps {
  isOpen: boolean;
  onClose: () => void;
  definedArchetypes: Archetype[];
  currentRefinements: Record<string, number>;
  onApplyRefinements: (newRefinements: Record<string, number>) => void;
}

export default function ArchetypeRefinementModal({
  isOpen,
  onClose,
  definedArchetypes,
  currentRefinements,
  onApplyRefinements,
}: ArchetypeRefinementModalProps) {
  const [localRefinements, setLocalRefinements] = useState<Record<string, number>>({});

  useEffect(() => {
    if (isOpen) {
      const initial: Record<string, number> = {};
      (definedArchetypes || []).forEach(arch => { // Ensure definedArchetypes is not undefined
        initial[arch.name] = currentRefinements[arch.name] !== undefined ? currentRefinements[arch.name] : 0;
      });
      setLocalRefinements(initial);
    }
  }, [isOpen, currentRefinements, definedArchetypes]);

  const handleSliderChange = (archetypeName: string, value: number) => {
    setLocalRefinements(prev => ({ ...prev, [archetypeName]: value }));
  };

  const handleTextChange = (archetypeName: string, textValue: string) => {
    let value = parseInt(textValue, 10);
    if (isNaN(value) || textValue.trim() === "") {
      value = 0; 
    }
    value = Math.max(0, Math.min(100, value));
    setLocalRefinements(prev => ({ ...prev, [archetypeName]: value }));
  };

  const handleApply = () => {
    const finalRefinements: Record<string, number> = {};
    (definedArchetypes || []).forEach(arch => {
        finalRefinements[arch.name] = localRefinements[arch.name] || 0;
    });
    onApplyRefinements(finalRefinements);
    onClose();
  };
  
  const handleResetToEvenDistribution = () => {
    const numArchetypes = (definedArchetypes || []).length;
    if (numArchetypes === 0) return;

    const evenSplit = Math.floor(100 / numArchetypes);
    const remainder = 100 % numArchetypes;
    
    const newRefinements: Record<string, number> = {};
    (definedArchetypes || []).forEach((arch, index) => {
      newRefinements[arch.name] = evenSplit + (index < remainder ? 1 : 0);
    });
    setLocalRefinements(newRefinements);
  };

  if (!isOpen) return null;

  const totalPercentage = Object.values(localRefinements || {}).reduce((sum, val) => sum + (Number(val) || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-2xl w-full max-w-md space-y-6 transform transition-all duration-300 ease-in-out scale-100 opacity-100">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Archetype Refinement</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {(definedArchetypes || []).map(archetype => (
            <div key={archetype.name} className="space-y-2 p-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span 
                    className="w-4 h-4 rounded-full mr-2.5 flex-shrink-0 border border-gray-300 dark:border-gray-600" 
                    style={{ backgroundColor: archetype.color || '#E0E0E0' }}
                    title={archetype.name}
                  ></span>
                  <label htmlFor={`text-${archetype.name.replace(/\s+/g, '-')}`} className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {archetype.name}
                  </label>
                </div>
                <input
                  id={`text-${archetype.name.replace(/\s+/g, '-')}`}
                  type="number"
                  min="0"
                  max="100"
                  value={localRefinements[archetype.name] !== undefined ? localRefinements[archetype.name] : ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => handleTextChange(archetype.name, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="w-20 text-sm font-semibold p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <input
                id={`slider-${archetype.name.replace(/\s+/g, '-')}`}
                type="range"
                min="0"
                max="100"
                value={localRefinements[archetype.name] || 0}
                onChange={(e: ChangeEvent<HTMLInputElement>) => handleSliderChange(archetype.name, parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 slider-thumb"
                style={{'--slider-thumb-color': archetype.color} as React.CSSProperties}
              />
            </div>
          ))}
        </div>
        
        <div className={`text-sm font-medium text-center py-2 px-3 rounded-md transition-colors ${totalPercentage === 100 ? 'bg-green-100 dark:bg-green-800/40 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-800/40 text-red-700 dark:text-red-300'}`}>
            Total: {totalPercentage}% {totalPercentage !== 100 && "(Must be 100%)"}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-0">
           <button
            onClick={handleResetToEvenDistribution}
            className="w-full sm:w-auto order-last sm:order-first px-4 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
          >
            Distribute Evenly
          </button>
          <div className="flex space-x-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="w-1/2 sm:w-auto flex-grow sm:flex-grow-0 px-4 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={totalPercentage !== 100}
              className="w-1/2 sm:w-auto flex-grow sm:flex-grow-0 px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-md shadow-sm disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}