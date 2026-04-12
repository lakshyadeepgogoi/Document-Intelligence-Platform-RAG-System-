'use client';

import { Message, Citation } from '@/lib/types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User, Brain, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { useState } from 'react';
import clsx from 'clsx';

interface MessageBubbleProps {
  message: Message;
  onFollowUp: (q: string) => void;
}

function CitationPanel({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);

  if (!citations.length) return null;

  return (
    <div className="mt-3">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition"
      >
        <FileText size={11} />
        {citations.length} source{citations.length !== 1 ? 's' : ''}
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {open && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {citations.map((c, i) => (
            <div key={c.chunkId} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">
                  {i + 1}
                </span>
                <span className="text-xs font-medium text-gray-300 truncate">{c.documentName}</span>
                {c.page && <span className="text-xs text-gray-500 ml-auto">p. {c.page}</span>}
              </div>
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({ message, onFollowUp }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-3 animate-fade-in', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1',
        isUser
          ? 'bg-gradient-to-br from-blue-500 to-violet-600'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600'
      )}>
        {isUser ? <User size={14} className="text-white" /> : <Brain size={14} className="text-white" />}
      </div>

      {/* Bubble */}
      <div className={clsx('max-w-[75%]', isUser ? 'items-end' : 'items-start', 'flex flex-col gap-1')}>
        <div className={clsx(
          'rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-violet-600 text-white rounded-tr-sm'
            : 'bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-sm'
        )}>
          {isUser ? (
            <p>{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className="text-[10px] text-gray-600 px-1">{formatTime(message.createdAt)}</span>

        {/* Citations */}
        {!isUser && message.citations && (
          <div className="px-1 w-full">
            <CitationPanel citations={message.citations} />
          </div>
        )}

        {/* Follow-up suggestions */}
        {!isUser && message.followUpQuestions && message.followUpQuestions.length > 0 && (
          <div className="px-1">
            <p className="text-[10px] text-gray-600 mb-1.5">Suggested follow-ups:</p>
            <div className="flex flex-wrap gap-2">
              {message.followUpQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-300 hover:border-blue-500 hover:text-blue-300 transition cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
