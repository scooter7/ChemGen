// app/(app)/profile/page.tsx
"use client";

import React, { useState, useEffect, FormEvent } from 'react'; // Added FormEvent
import { useRouter } from 'next/navigation';
// import { UserCircle2 } from 'lucide-react'; // Already imported if you used it for avatar

interface UserProfileData {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  department?: string | null;
  title?: string | null;
  languages?: string[] | null;
  recruitmentRegion?: string | null;
}

// For the form data during editing
interface EditableProfileData {
  name: string;
  department: string;
  title: string;
  languages: string; // Will handle as comma-separated string in input
  recruitmentRegion: string;
}

export default function ProfilePage() {
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [editableData, setEditableData] = useState<EditableProfileData>({
    name: '',
    department: '',
    title: '',
    languages: '',
    recruitmentRegion: '',
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // For save operation
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  // const router = useRouter(); // Keep if needed for other navigation

  const fetchProfile = async () => {
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/user/profile');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch profile: ${response.status}`);
      }
      const data: UserProfileData = await response.json();
      setProfileData(data);
      // Initialize editableData when profileData is fetched
      setEditableData({
        name: data.name || '',
        department: data.department || '',
        title: data.title || '',
        languages: data.languages?.join(', ') || '', // Join array for text input
        recruitmentRegion: data.recruitmentRegion || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error("Error fetching profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditableData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    // Convert comma-separated languages string back to array, trim whitespace
    const languagesArray = editableData.languages.split(',').map(lang => lang.trim()).filter(lang => lang !== '');

    const updatePayload = {
      name: editableData.name,
      department: editableData.department,
      title: editableData.title,
      languages: languagesArray,
      recruitmentRegion: editableData.recruitmentRegion,
    };

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to update profile.');
      }

      setProfileData(result.user); // Update displayed profile with new data from API
      setSuccessMessage('Profile updated successfully!');
      setIsEditing(false); // Exit edit mode
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during update.');
      console.error("Error updating profile:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const displayArrayData = (dataArray: string[] | null | undefined) => {
    if (dataArray && dataArray.length > 0) return dataArray.join(', ');
    return 'N/A';
  };

  if (isLoading) return <div className="p-8 text-center"><p>Loading profile...</p></div>;
  // Error and no data states are handled by profileData check below

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white dark:bg-gray-800 shadow-xl rounded-lg p-6 md:p-10">
        {error && <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md text-sm">{error}</div>}
        {successMessage && <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md text-sm">{successMessage}</div>}

        {!profileData && !isLoading && !error && (
             <div className="p-8 text-center"><p>No profile data found.</p></div>
        )}

        {profileData && (
          <>
            <div className="flex items-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-2xl font-semibold mr-6">
                {profileData.name ? profileData.name.substring(0, 1).toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                  Hi {isEditing ? editableData.name : profileData.name || profileData.email || 'User'}.
                </h1>
              </div>
            </div>

            {!isEditing ? (
              <>
                <div className="space-y-5">
                  {/* Display Fields */}
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</p><p className="text-md text-gray-800 dark:text-gray-100">{profileData.department || 'N/A'}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</p><p className="text-md text-gray-800 dark:text-gray-100">{profileData.name || 'N/A'}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</p><p className="text-md text-gray-800 dark:text-gray-100">{profileData.title || 'N/A'}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Languages</p><p className="text-md text-gray-800 dark:text-gray-100">{displayArrayData(profileData.languages)}</p></div>
                  <div><p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Recruitment Region</p><p className="text-md text-gray-800 dark:text-gray-100">{profileData.recruitmentRegion || 'N/A'}</p></div>
                </div>
                <p className="mt-8 text-sm text-gray-600 dark:text-gray-400 italic">Our AI tool uses this info to personalize your experience.</p>
                <div className="mt-10 text-right">
                  <button onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white font-semibold rounded-md shadow-md">Edit Profile</button>
                </div>
              </>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                {/* Editable Fields */}
                <div>
                  <label htmlFor="name" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Name</label>
                  <input type="text" name="name" id="name" value={editableData.name} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white sm:text-sm"/>
                </div>
                <div>
                  <label htmlFor="department" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Department</label>
                  <input type="text" name="department" id="department" value={editableData.department} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white sm:text-sm"/>
                </div>
                <div>
                  <label htmlFor="title" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Title</label>
                  <input type="text" name="title" id="title" value={editableData.title} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white sm:text-sm"/>
                </div>
                <div>
                  <label htmlFor="languages" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Languages (comma-separated)</label>
                  <input type="text" name="languages" id="languages" value={editableData.languages} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white sm:text-sm"/>
                </div>
                <div>
                  <label htmlFor="recruitmentRegion" className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Recruitment Region</label
                  ><input type="text" name="recruitmentRegion" id="recruitmentRegion" value={editableData.recruitmentRegion} onChange={handleInputChange} className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm dark:bg-gray-700 dark:text-white sm:text-sm"/>
                </div>
                <div className="mt-10 flex justify-end space-x-3">
                  <button type="button" onClick={() => { setIsEditing(false); setError(null); setSuccessMessage(null); /* Reset editableData if desired */ }} className="px-6 py-2.5 border border-gray-300 dark:border-gray-500 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-md disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}