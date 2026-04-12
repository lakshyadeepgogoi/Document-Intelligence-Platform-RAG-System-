'use client';

import { Document } from '@/lib/types';
import { formatBytes, getFileIcon } from '@/lib/utils';
import { Trash2, Clock, CheckCircle, XCircle, Loader2, MessageSquarePlus } from 'lucide-react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useState } from 'react';

interface DocumentCardProps {
  doc: Document;
  onDelete: () => void;
}

const statusConfig = {
  pending:    { label: 'Pending',    icon: Clock,         color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  processing: { label: 'Processing', icon: Loader2,       color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20'     },
  ready:      { label: 'Ready',      icon: CheckCircle,   color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20'},
  failed:     { label: 'Failed',     icon: XCircle,       color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'       },
};

export default function DocumentCard({ doc, onDelete }: DocumentCardProps) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();
  const status = statusConfig[doc.status];
  const StatusIcon = status.icon;

  const handleDelete = async () => {
    if (!confirm(`Delete "${doc.originalName}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/documents/${doc._id}`);
      toast.success('Document deleted');
      onDelete();
    } catch {
      toast.error('Failed to delete document');
    } finally {
      setDeleting(false);
    }
  };

  const handleChat = async () => {
    try {
      const res = await api.post('/chats', {
        title: `Chat about ${doc.originalName}`,
        scopedDocumentIds: [doc._id],
      });
      router.push(`/chat/${res.data.chat._id}`);
    } catch {
      toast.error('Failed to create chat');
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-gray-700 transition-all duration-200 animate-fade-in group">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 text-lg">
          {getFileIcon(doc.mimeType)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate" title={doc.originalName}>
            {doc.originalName}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{formatBytes(doc.size)}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border w-fit', status.bg, status.color)}>
        <StatusIcon size={12} className={clsx(doc.status === 'processing' && 'animate-spin')} />
        {status.label}
        {doc.status === 'ready' && doc.chunkCount > 0 && (
          <span className="text-gray-500 font-normal ml-1">· {doc.chunkCount} chunks</span>
        )}
      </div>

      {/* Error message */}
      {doc.status === 'failed' && doc.errorMessage && (
        <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{doc.errorMessage}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-gray-800">
        <button
          id={`chat-doc-${doc._id}`}
          onClick={handleChat}
          disabled={doc.status !== 'ready'}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          <MessageSquarePlus size={13} />
          Chat
        </button>
        <button
          id={`delete-doc-${doc._id}`}
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-xl bg-red-500/5 text-red-400 border border-red-500/20 hover:bg-red-500/15 disabled:opacity-40 transition"
        >
          {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        </button>
      </div>
    </div>
  );
}
