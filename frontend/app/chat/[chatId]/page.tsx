'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import MessageBubble from '@/components/chat/MessageBubble';
import ChatInput from '@/components/chat/ChatInput';
import api from '@/lib/api';
import { Chat, Document, Message } from '@/lib/types';
import {
  Loader2, Brain, Settings2, X, ChevronDown, ChevronUp,
  FileText, CheckSquare, Square, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';

export default function ChatPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  // Document scope selector
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [savingScope, setSavingScope] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const fetchChat = useCallback(async () => {
    try {
      const res = await api.get(`/chats/${chatId}`);
      const c: Chat = res.data.chat;
      setChat(c);
      setMessages(c.messages || []);
      setSelectedDocIds(
        c.scopedDocumentIds
          .map((d) => (typeof d === 'string' ? d : d._id))
          .filter(Boolean)
      );
    } catch {
      toast.error('Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  const fetchDocs = useCallback(async () => {
    const res = await api.get('/documents');
    setAllDocs(res.data.documents.filter((d: Document) => d.status === 'ready'));
  }, []);

  useEffect(() => {
    if (user) {
      fetchChat();
      fetchDocs();
    }
  }, [user, fetchChat, fetchDocs]);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const handleSend = async (content: string) => {
    setSending(true);

    // Optimistic user message
    const optimistic: Message = {
      _id: `opt-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const res = await api.post(`/chats/${chatId}/messages`, { content });
      const assistantMsg: Message = res.data.message;

      // Replace optimistic and append assistant message
      setMessages((prev) => {
        const without = prev.filter((m) => m._id !== optimistic._id);
        return [
          ...without,
          { ...optimistic, _id: `user-${Date.now()}` },
          assistantMsg,
        ];
      });

      // Update chat title
      if (chat?.title === 'New Chat') {
        setChat((prev) => prev ? { ...prev, title: content.slice(0, 60) } : prev);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to get response');
      setMessages((prev) => prev.filter((m) => m._id !== optimistic._id));
    } finally {
      setSending(false);
    }
  };

  const handleFollowUp = (question: string) => {
    handleSend(question);
  };

  const toggleDocScope = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const saveScope = async () => {
    setSavingScope(true);
    try {
      await api.patch(`/chats/${chatId}/scope`, { scopedDocumentIds: selectedDocIds });
      toast.success('Document scope updated');
      setScopeOpen(false);
    } catch {
      toast.error('Failed to update scope');
    } finally {
      setSavingScope(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen bg-gray-950">
        <Sidebar />
        <div className="ml-64 flex-1 flex items-center justify-center">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />

      <div className="ml-64 flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          <button
            onClick={() => router.push('/chat')}
            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-gray-800 transition"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center">
            <Brain size={15} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-white truncate">{chat?.title}</h2>
            <p className="text-xs text-gray-500">
              {selectedDocIds.length > 0
                ? `Scoped to ${selectedDocIds.length} document${selectedDocIds.length !== 1 ? 's' : ''}`
                : 'All documents'}
            </p>
          </div>

          {/* Scope button */}
          <button
            id="scope-btn"
            onClick={() => setScopeOpen(!scopeOpen)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition',
              scopeOpen
                ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                : 'bg-gray-800 text-gray-400 hover:text-white border-gray-700'
            )}
          >
            <Settings2 size={13} />
            Scope
            {scopeOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Document Scope Panel */}
        {scopeOpen && (
          <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4 animate-fade-in flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Select documents to search
              </p>
              <button onClick={() => setScopeOpen(false)} className="text-gray-500 hover:text-white transition">
                <X size={14} />
              </button>
            </div>

            {allDocs.length === 0 ? (
              <p className="text-xs text-gray-500">No ready documents. Upload and process documents first.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {allDocs.map((doc) => {
                  const selected = selectedDocIds.includes(doc._id);
                  return (
                    <button
                      key={doc._id}
                      onClick={() => toggleDocScope(doc._id)}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left transition',
                        selected
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-300'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                      )}
                    >
                      {selected ? (
                        <CheckSquare size={13} className="text-blue-400 flex-shrink-0" />
                      ) : (
                        <Square size={13} className="text-gray-600 flex-shrink-0" />
                      )}
                      <FileText size={13} className="flex-shrink-0" />
                      <span className="truncate">{doc.originalName}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={saveScope}
                disabled={savingScope}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 transition"
              >
                {savingScope && <Loader2 size={12} className="animate-spin" />}
                Apply Scope
              </button>
              <button
                onClick={() => { setSelectedDocIds([]); }}
                className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-xs font-medium transition"
              >
                Clear (All docs)
              </button>
            </div>
          </div>
        )}

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center mb-4">
                <Brain size={28} className="text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold text-lg">Ready to answer your questions</h3>
              <p className="text-gray-400 text-sm mt-2 max-w-sm">
                Ask anything about your uploaded documents. I'll find and cite the relevant information.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg._id} message={msg} onFollowUp={handleFollowUp} />
          ))}

          {/* Thinking indicator */}
          {sending && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 mt-1">
                <Brain size={14} className="text-white" />
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-gray-800 bg-gray-950">
          <ChatInput
            onSend={handleSend}
            loading={sending}
          />
          <p className="text-[10px] text-gray-600 text-center mt-2">
            Responses are grounded in your documents · Citations provided for every answer
          </p>
        </div>
      </div>
    </div>
  );
}
