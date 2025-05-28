'use client';

import { useState, useRef, ChangeEvent } from 'react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { DocumentTextIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface FileUploadProps {
  onUploadComplete?: () => void;
  className?: string;
}

export default function FileUpload({ onUploadComplete, className = '' }: FileUploadProps) {
  const { currentUser } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Lütfen bir dosya seçin');
      return;
    }

    if (!currentUser) {
      setError('Yüklemek için giriş yapmalısınız');
      return;
    }

    setIsUploading(true);
    setError('');

    try {
      // Create a reference to the file in Firebase Storage
      const fileRef = ref(storage, `documents/${currentUser.uid}/${Date.now()}_${selectedFile.name}`);
      
      // Upload the file
      const uploadTask = uploadBytesResumable(fileRef, selectedFile);

      // Monitor upload progress
      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(progress);
        },
        (error) => {
          console.error('Upload error:', error);
          setError('Dosya yüklenirken bir hata oluştu');
          setIsUploading(false);
        },
        async () => {
          try {
            // Get the download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            
            // Save document metadata to Firestore
            const fileNameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, ''); // Remove file extension
            await addDoc(collection(db, 'documents'), {
              title: fileNameWithoutExt, // Use the filename (without extension) as the title
              content: downloadURL, // Store the download URL in the content field
              url: downloadURL,
              type: selectedFile.type,
              size: selectedFile.size,
              ownerId: currentUser.uid,
              ownerName: currentUser.email,
              isFile: true, // Add a flag to identify file uploads
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });

            // Reset form and call callback
            setSelectedFile(null);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            setProgress(0);
            
            if (onUploadComplete) {
              onUploadComplete();
            }
          } catch (error) {
            console.error('Error saving document info:', error);
            setError('Doküman bilgileri kaydedilirken bir hata oluştu');
          } finally {
            setIsUploading(false);
          }
        }
      );
    } catch (error) {
      console.error('Upload error:', error);
      setError('Dosya yüklenirken bir hata oluştu');
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-4 relative z-10 ${className || ''}`}>
      <div className="flex items-center justify-center w-full">
        <div className="w-full max-w-md">
          <div className="relative">
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors relative z-10"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                <DocumentTextIcon className="w-10 h-10 mb-3 text-gray-500" />
                <p className="mb-2 text-sm text-gray-600">
                  <span className="font-semibold text-indigo-600">Dosyayı sürükleyin</span> veya tıklayın
                </p>
                <p className="text-xs text-gray-500 px-4">
                  PDF, DOC, DOCX, TXT dosyalarını yükleyebilirsiniz (Maks: 10MB)
                </p>
              </div>
              <input
                id="file-upload"
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.txt"
                disabled={isUploading}
              />
            </label>
            <div className="mt-2 flex justify-center relative z-20">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="relative z-30 text-sm text-indigo-600 hover:text-indigo-800 font-medium bg-white px-3 py-1 rounded-md hover:bg-gray-50"
                disabled={isUploading}
              >
                Bilgisayarımdan seç
              </button>
            </div>
          </div>
        </div>
      </div>

      {selectedFile && (
        <div className="p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={removeFile}
              className="text-gray-400 hover:text-gray-600"
              disabled={isUploading}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {isUploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-indigo-600 h-2.5 rounded-full"
            style={{ width: `${Math.round(progress)}%` }}
          ></div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600">{error}</div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className={`px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
            (!selectedFile || isUploading) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isUploading ? 'Yükleniyor...' : 'Yükle'}
        </button>
      </div>
    </div>
  );
}
