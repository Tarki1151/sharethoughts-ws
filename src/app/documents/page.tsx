'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc as firestoreDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, storage } from '@/lib/firebase';
import { ref, deleteObject } from 'firebase/storage';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PlusIcon, DocumentTextIcon, PencilIcon, TrashIcon, ArrowUpTrayIcon, DocumentArrowDownIcon } from '@heroicons/react/24/outline';
import FileUpload from '@/components/FileUpload';

interface DocumentType {
  id: string;
  title: string;
  content: string;
  url?: string;
  type?: string;
  size?: number;
  isFile?: boolean;
  ownerId: string;
  ownerName?: string;
  createdAt: any;
  updatedAt: any;
}

export default function DocumentsPage() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleDocumentClick = (doc: DocumentType) => {
    if (doc.isFile && doc.url) {
      // For files, open in new tab
      window.open(doc.url, '_blank');
    } else {
      // For regular documents, navigate to editor
      router.push(`/documents/${doc.id}`);
    }
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    // Refresh the documents list
    fetchDocuments();
  };

  const fetchDocuments = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const q = query(
        collection(db, 'documents'),
        where('ownerId', '==', currentUser.uid),
        orderBy('updatedAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const docs: DocumentType[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        docs.push({
          id: doc.id,
          title: data.title || 'Untitled Document',
          content: data.content || '',
          url: data.url,
          type: data.type,
          size: data.size,
          isFile: data.isFile || false,
          ownerId: data.ownerId,
          ownerName: data.ownerName,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
      });
      
      setDocuments(docs);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [currentUser]);

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newDocTitle.trim() || !currentUser) return;
    
    try {
      setIsCreating(true);
      const docRef = await addDoc(collection(db, 'documents'), {
        title: newDocTitle.trim(),
        content: '',
        ownerId: currentUser.uid,
        ownerName: currentUser.email,
        isFile: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Navigate to the new document
      router.push(`/documents/${docRef.id}`);
    } catch (error) {
      console.error('Error creating document:', error);
    } finally {
      setIsCreating(false);
      setNewDocTitle('');
      setShowCreateModal(false);
    }
  };

  const formatDate = (date: any) => {
    if (!date) return '';
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString('tr-TR');
  };

  return (
    <ProtectedRoute>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dokümanlarım</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Yeni Doküman
            </button>
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <ArrowUpTrayIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" aria-hidden="true" />
              Dosya Yükle
            </button>
          </div>
        </div>

        {loading ? (
          <div>Yükleniyor...</div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {documents.map((doc) => (
                <li 
                  key={doc.id}
                  onClick={() => handleDocumentClick(doc)}
                  className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {doc.isFile ? (
                        <DocumentArrowDownIcon className="h-6 w-6 text-blue-500" />
                      ) : (
                        <DocumentTextIcon className="h-6 w-6 text-gray-400" />
                      )}
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">
                          {doc.title}
                          {doc.isFile && doc.type && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({doc.type.split('/')[1] || 'file'})
                            </span>
                          )}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {formatDate(doc.updatedAt)}
                          {doc.size && (
                            <span className="ml-2">
                              • {(doc.size / 1024).toFixed(1)} KB
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      {!doc.isFile && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/documents/${doc.id}`);
                          }}
                          className="text-gray-400 hover:text-gray-600"
                          title="Düzenle"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                      )}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (window.confirm('Bu öğeyi silmek istediğinizden emin misiniz?')) {
                            try {
                              // Delete the document from Firestore
                              await deleteDoc(firestoreDoc(db, 'documents', doc.id));
                              
                              // If it's a file, also delete it from Storage
                              if (doc.isFile && doc.url) {
                                try {
                                  // Extract the file path from the download URL
                                  const filePath = decodeURIComponent(doc.url.split('/o/')[1].split('?')[0]);
                                  const fileRef = ref(storage, filePath);
                                  await deleteObject(fileRef);
                                } catch (storageError) {
                                  console.error('Error deleting file from storage:', storageError);
                                  // Continue even if storage deletion fails
                                }
                              }
                              
                              // Update the UI by removing the deleted document
                              setDocuments(documents.filter(d => d.id !== doc.id));
                            } catch (error) {
                              console.error('Error deleting document:', error);
                              alert('Doküman silinirken bir hata oluştu. Lütfen tekrar deneyin.');
                            }
                          }
                        }}
                        className="text-gray-400 hover:text-red-600"
                        title="Sil"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
              {documents.length === 0 && !loading && (
                <li className="px-4 py-6 text-center text-gray-500">
                  Henüz hiç dokümanınız yok. Yeni bir doküman oluşturun veya dosya yükleyin.
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Create Document Modal */}
        {showCreateModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Yeni Doküman Oluştur
                    </h3>
                    <div className="mt-2">
                      <input
                        type="text"
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
                        placeholder="Doküman başlığı girin"
                        autoFocus
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:col-start-2 sm:text-sm"
                    onClick={handleCreateDocument}
                    disabled={isCreating || !newDocTitle.trim()}
                  >
                    {isCreating ? 'Oluşturuluyor...' : 'Oluştur'}
                  </button>
                  <button
                    type="button"
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
                    onClick={() => setShowCreateModal(false)}
                  >
                    İptal
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Modal */}
        {showUploadModal && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>
              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
              <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-5">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Dosya Yükle
                    </h3>
                    <div className="mt-2">
                      <FileUpload onUploadComplete={handleUploadComplete} />
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6">
                  <button
                    type="button"
                    className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm"
                    onClick={() => setShowUploadModal(false)}
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

// Add the fetchDocuments function
async function fetchDocuments() {
  // This function will be called after a successful upload
  // to refresh the documents list
  // The implementation depends on your existing code structure
  // You might need to move the fetching logic from useEffect to this function
  // and call it both in useEffect and after successful upload
  window.location.reload(); // Simple solution for now
}
