'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, X } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';

interface UploadZoneProps {
  onUploadComplete: () => void;
}

interface PendingFile {
  file: File;
  uploading: boolean;
  error?: string;
}

export default function UploadZone({ onUploadComplete }: UploadZoneProps) {
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);

  const uploadFile = async (pf: PendingFile) => {
    const formData = new FormData();
    formData.append('file', pf.file);

    setPendingFiles((prev) =>
      prev.map((f) => (f.file === pf.file ? { ...f, uploading: true } : f))
    );

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(`"${pf.file.name}" uploaded — processing started`);
      setPendingFiles((prev) => prev.filter((f) => f.file !== pf.file));
      onUploadComplete();
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Upload failed';
      toast.error(msg);
      setPendingFiles((prev) =>
        prev.map((f) => (f.file === pf.file ? { ...f, uploading: false, error: msg } : f))
      );
    }
  };

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newFiles: PendingFile[] = accepted.map((f) => ({ file: f, uploading: false }));
      setPendingFiles((prev) => [...prev, ...newFiles]);
      newFiles.forEach(uploadFile);
    },
    [onUploadComplete]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
      'application/vnd.ms-powerpoint': ['.ppt'],
      'text/plain': ['.txt'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
  });

  return (
    <div className="space-y-3">
      <div
        id="upload-dropzone"
        {...getRootProps()}
        className={clsx(
          'relative border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 group',
          isDragActive
            ? 'border-blue-500 bg-blue-500/5 animate-pulse-border'
            : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/50'
        )}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className={clsx(
            'w-14 h-14 rounded-2xl flex items-center justify-center transition-colors',
            isDragActive ? 'bg-blue-500/20' : 'bg-gray-800 group-hover:bg-gray-700'
          )}>
            <Upload size={24} className={clsx(isDragActive ? 'text-blue-400' : 'text-gray-400')} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-200">
              {isDragActive ? 'Drop files here' : 'Drag & drop files'}
            </p>
            <p className="text-xs text-gray-500 mt-1">or click to browse</p>
            <p className="text-xs text-gray-600 mt-2">PDF, DOCX, PPTX, TXT · Max 50MB</p>
          </div>
        </div>
      </div>

      {/* Uploading files list */}
      {pendingFiles.length > 0 && (
        <div className="space-y-2">
          {pendingFiles.map((pf, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3 border border-gray-700"
            >
              <FileText size={16} className="text-blue-400 flex-shrink-0" />
              <span className="text-sm text-gray-200 flex-1 truncate">{pf.file.name}</span>
              {pf.uploading ? (
                <Loader2 size={15} className="text-blue-400 animate-spin flex-shrink-0" />
              ) : pf.error ? (
                <span className="text-xs text-red-400">{pf.error}</span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
