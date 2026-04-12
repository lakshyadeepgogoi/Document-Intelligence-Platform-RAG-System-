'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/layout/Sidebar';
import api from '@/lib/api';
import { Chat } from '@/lib/types';
import { Plus, MessageSquare, Loader2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/utils';

export default function ChatListPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    api.get('/chats')
      .then((res) => setChats(res.data.chats))
      .catch(() => toast.error('Failed to load chats'))
      .finally(() => setLoading(false));
  }, [user]);

  const createChat = async () => {
    try {
      const res = await api.post('/chats', { title: 'New Chat' });
      router.push(`/chat/${res.data.chat._id}`);
    } catch {
      toast.error('Failed to create chat');
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/chats/${chatId}`);
      setChats((prev) => prev.filter((c) => c._id !== chatId));
      toast.success('Chat deleted');
    } catch {
      toast.error('Failed to delete chat');
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-950">
      <Sidebar />
      <main className="ml-64 flex-1 p-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Chats</h2>
            <p className="text-gray-400 text-sm mt-0.5">{chats.length} conversation{chats.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            id="new-chat-btn"
            onClick={createChat}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white text-sm font-semibold transition shadow-lg shadow-blue-500/20 hover:-translate-y-0.5 duration-200"
          >
            <Plus size={15} />
            New Chat
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center h-48 items-center">
            <Loader2 size={28} className="animate-spin text-blue-500" />
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
              <MessageSquare size={28} className="text-gray-500" />
            </div>
            <h3 className="text-gray-300 font-semibold text-lg">No chats yet</h3>
            <p className="text-gray-500 text-sm mt-1 mb-6">Start a new conversation about your documents</p>
            <button
              onClick={createChat}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
            >
              New Chat
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => (
              <div
                key={chat._id}
                id={`chat-${chat._id}`}
                onClick={() => router.push(`/chat/${chat._id}`)}
                className="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-4 cursor-pointer hover:border-gray-700 hover:bg-gray-800/50 transition group animate-fade-in"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={17} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{chat.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(chat.updatedAt)}</p>
                </div>
                <button
                  onClick={(e) => deleteChat(chat._id, e)}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
