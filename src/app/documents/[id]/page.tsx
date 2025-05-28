'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ArrowLeftIcon, DocumentArrowDownIcon as SaveIcon, ShareIcon, UsersIcon } from '@heroicons/react/24/outline';
import { debounce } from 'lodash';

interface DocumentData {
  id: string;
  title: string;
  content: string;
  ownerId: string;
  updatedAt: any;
  collaborators?: string[];
}

export default function DocumentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  
  const [document, setDocument] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isOwner, setIsOwner] = useState(false);

  // Fetch document data
  useEffect(() => {
    if (!id || !currentUser) return;

    const docRef = doc(db, 'documents', id as string);
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as Omit<DocumentData, 'id'>;
        setDocument({ id: docSnap.id, ...data });
        setTitle(data.title);
        setContent(data.content || '');
        setIsOwner(data.ownerId === currentUser.uid);
        setError('');
      } else {
        setError('Document not found');
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching document:', error);
      setError('Error loading document');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, currentUser]);

  // Auto-save document
  const saveDocument = useCallback(debounce(async (docId: string, title: string, content: string) => {
    if (!currentUser) return;
    
    try {
      setSaving(true);
      const docRef = doc(db, 'documents', docId);
      await updateDoc(docRef, {
        title,
        content,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving document:', error);
      setError('Failed to save document');
    } finally {
      setSaving(false);
    }
  }, 1000), [currentUser]);

  // Save when title or content changes
  useEffect(() => {
    if (document && (title !== document.title || content !== document.content)) {
      saveDocument(document.id, title, content);
    }
  }, [title, content, document, saveDocument]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !document) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
            <p className="text-gray-600 mb-6">{error || 'Document not found'}</p>
            <button
              onClick={() => router.push('/documents')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Back to Documents
            </button>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => router.push('/documents')}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowLeftIcon className="h-6 w-6" aria-hidden="true" />
                </button>
                <div className="ml-4 flex items-center">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xl font-medium text-gray-900 bg-transparent border-0 focus:ring-0 focus:outline-none"
                    disabled={!isOwner}
                  />
                  {saving && (
                    <span className="ml-2 text-sm text-gray-500">Saving...</span>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ShareIcon className="-ml-0.5 mr-2 h-4 w-4" aria-hidden="true" />
                  Share
                </button>
                {document.collaborators && document.collaborators.length > 0 && (
                  <div className="flex items-center text-sm text-gray-500">
                    <UsersIcon className="h-5 w-5 text-gray-400 mr-1" />
                    <span>{document.collaborators.length} collaborator{document.collaborators.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Document content */}
        <div className="flex-1 overflow-y-auto bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="prose max-w-none">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-full min-h-[calc(100vh-200px)] p-4 border-0 focus:ring-0 focus:outline-none resize-none"
                placeholder="Start writing your document here..."
                disabled={!isOwner}
              />
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
