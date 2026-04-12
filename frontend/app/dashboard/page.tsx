'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import UploadZone from '@/components/documents/UploadZone';
import DocumentCard from '@/components/documents/DocumentCard';
import api from '@/lib/api';
import { Document } from '@/lib/types';
import { Loader2, FileX2, RefreshCw, Plus, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data.documents);
    } catch {
      toast.error('Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) fetchDocuments();
  }, [user, fetchDocuments]);

  // Poll for processing documents every 5s
  useEffect(() => {
    const hasProcessing = documents.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    );
    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleNewChat = async () => {
    try {
      const res = await api.post('/chats', { title: 'New Chat' });
      router.push(`/chat/${res.data.chat._id}`);
    } catch {
      toast.error('Failed to create chat');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  const readyCount = documents.filter((d) => d.status === 'ready').length;
  const processingCount = documents.filter(
    (d) => d.status === 'pending' || d.status === 'processing'
  ).length;

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />

      <main className="ml-64 flex-1 p-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Documents</h2>
            <p className="text-gray-400 text-sm mt-0.5">
              {readyCount} ready · {processingCount} processing · {documents.length} total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              id="new-chat-btn"
              onClick={handleNewChat}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700 text-sm font-medium border border-gray-700 transition"
            >
              <MessageSquare size={15} />
              New Chat
            </button>
            <button
              id="upload-toggle-btn"
              onClick={() => setShowUpload(!showUpload)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 duration-200"
            >
              <Plus size={15} />
              Upload
            </button>
          </div>
        </div>

        {/* Upload Zone */}
        {showUpload && (
          <div className="mb-8 animate-fade-in">
            <UploadZone
              onUploadComplete={() => {
                setShowUpload(false);
                fetchDocuments();
              }}
            />
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Total Documents', value: documents.length, color: 'text-white' },
            { label: 'Ready to Query', value: readyCount, color: 'text-emerald-400' },
            { label: 'Processing', value: processingCount, color: 'text-blue-400' },
          ].map((stat) => (
            <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{stat.label}</p>
              <p className={`text-3xl font-bold mt-2 ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Document Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
              <FileX2 size={28} className="text-gray-500" />
            </div>
            <h3 className="text-gray-300 font-semibold text-lg">No documents yet</h3>
            <p className="text-gray-500 text-sm mt-1 mb-6">Upload your first document to get started</p>
            <button
              onClick={() => setShowUpload(true)}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
            >
              Upload Document
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-400">All Documents</h3>
              <button
                onClick={fetchDocuments}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <DocumentCard key={doc._id} doc={doc} onDelete={fetchDocuments} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
