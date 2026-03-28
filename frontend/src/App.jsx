import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Paperclip, Send, User, PlusCircle, Sparkles, Zap, Cpu, Trash2, Menu, X, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import logger from './utils/logger';

const API_BASE_URL = 'http://localhost:5001';

// --- Sub-components ---

const MessageItem = ({ msg, isLast, loading }) => {
  const isBot = msg.role === 'assistant' || msg.sender === 'bot';
  const text = msg.content || msg.text;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-6 w-full`}
    >
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isBot ? 'flex-row' : 'flex-row-reverse'} items-start gap-3`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isBot
          ? 'bg-slate-900 border border-indigo-500/30 text-indigo-400'
          : 'bg-indigo-600 text-white shadow-indigo-600/20'
          }`}>
          {isBot ? <Cpu size={20} /> : <User size={20} />}
        </div>

        <div className={`relative px-5 py-3.5 rounded-2xl transition-all duration-300 ${isBot
          ? 'glass-card text-slate-200 rounded-tl-none border-indigo-500/10'
          : 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-600/10'
          }`}>
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>

          {isBot && isLast && loading && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
          )}

          {isBot && (
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Sidebar = ({ chats, activeChatId, onSelect, onNew, onDelete, isOpen, setIsOpen }) => (
  <>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
        />
      )}
    </AnimatePresence>

    <aside
      className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
    >
      <div className="flex flex-col h-full w-full">
        <div className="p-4 border-b border-white/5 md:border-none">
          <button
            onClick={onNew}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all duration-300 group shadow-lg shadow-indigo-600/10"
          >
            <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span className="font-bold text-sm">New Chat</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-2">Previous Chat History</p>
          {chats.length > 0 ? (
            chats.map((chat) => (
              <div
                key={chat.chat_id}
                onClick={() => onSelect(chat.chat_id)}
                className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${activeChatId === chat.chat_id
                  ? 'bg-indigo-600/20 border border-indigo-500/20 text-white'
                  : 'hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
              >
                <MessageSquare size={16} className={activeChatId === chat.chat_id ? 'text-indigo-400' : 'text-slate-500'} />
                <span className="flex-1 truncate text-xs font-semibold">{chat.title}</span>
                <button
                  onClick={(e) => onDelete(e, chat.chat_id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-700 space-y-3 opacity-40">
              <div className="w-12 h-12 rounded-2xl border border-dashed border-slate-700 flex items-center justify-center">
                <MessageSquare size={24} strokeWidth={1} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest">No Chats Found</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-white/5 bg-slate-950/80">
          <div className="flex items-center gap-3 px-2">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-200 truncate tracking-tight">AI Assistant</p>
              <p className="text-[9px] text-slate-500 truncate uppercase tracking-tighter">Enterprise Mode Enabled</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  </>
);

// --- Main App ---

function App() {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userId] = useState(() => {
    let id = localStorage.getItem('gemini_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('gemini_user_id', id);
    }
    return id;
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const abortControllers = useRef(new Map());

  const activeChat = useMemo(() => chats.find(c => c.chat_id === activeChatId), [chats, activeChatId]);
  const messages = activeChat?.messages || [];
  const isLoading = activeChat?.loading || false;

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const fetchChats = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/chats`);
      const data = await response.json();
      if (Array.isArray(data)) {
        setChats(prev => {
          // Merge incoming chats with existing local state (to preserve ongoing streams)
          const newChats = data.map(c => {
            const existing = prev.find(p => p.chat_id === c.chat_id);
            return {
              ...c,
              messages: existing?.messages || [],
              loading: existing?.loading || false
            };
          });
          return newChats;
        });
        
        // Auto-select first chat if none active
        if (!activeChatId && data.length > 0) {
          setActiveChatId(data[0].chat_id);
        }
      }
    } catch (error) {
      logger.error('Failed to fetch chats', { error: error.message });
    }
  }, [activeChatId]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const selectChat = useCallback(async (chatId) => {
    setActiveChatId(chatId);
    setIsSidebarOpen(false);

    // Lazy load messages if not already in state
    const chat = chats.find(c => c.chat_id === chatId);
    if (chat && chat.messages.length === 0) {
      try {
        const response = await fetch(`${API_BASE_URL}/chat/${chatId}`);
        const data = await response.json();
        if (data.messages) {
          setChats(prev => prev.map(p => 
            p.chat_id === chatId ? { ...p, messages: data.messages } : p
          ));
        }
      } catch (error) {
        logger.error('Failed to load chat history', { chatId, error: error.message });
      }
    }
  }, [chats]);

  const startNewChat = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/new-chat`, { method: 'POST' });
      const data = await response.json();
      if (data.chat_id) {
        setChats(prev => [{
          chat_id: data.chat_id,
          title: 'New Chat',
          messages: [],
          loading: false
        }, ...prev]);
        setActiveChatId(data.chat_id);
        setIsSidebarOpen(false);
      }
    } catch (error) {
      logger.error('Failed to start new chat', { error: error.message });
    }
  }, []);

  const deleteChat = useCallback(async (e, chatId) => {
    e.stopPropagation();
    try {
      await fetch(`${API_BASE_URL}/chat/delete/${chatId}`, { method: 'DELETE' });
      setChats(prev => prev.filter(c => c.chat_id !== chatId));
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
      
      // Cancel any ongoing requests for this chat
      if (abortControllers.current.has(chatId)) {
        abortControllers.current.get(chatId).abort();
        abortControllers.current.delete(chatId);
      }
    } catch (error) {
      logger.error('Failed to delete chat', { error: error.message });
    }
  }, [activeChatId]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeChatId || isLoading) return;

    const targetChatId = activeChatId; // CAPTURE originating chat_id for closure
    const userMsg = input.trim();
    setInput('');

    // Cancel existing request for THIS chat if it exists
    if (abortControllers.current.has(targetChatId)) {
      abortControllers.current.get(targetChatId).abort();
    }
    const controller = new AbortController();
    abortControllers.current.set(targetChatId, controller);

    // Optimistic Update
    setChats(prev => prev.map(chat => 
      chat.chat_id === targetChatId 
        ? { 
            ...chat, 
            messages: [...chat.messages, { role: 'user', content: userMsg }, { role: 'assistant', content: '', id: 'streaming' }],
            loading: true 
          } 
        : chat
    ));

    try {
      // Sync user message to DB
      await fetch(`${API_BASE_URL}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetChatId, role: 'user', content: userMsg }),
        signal: controller.signal
      });

      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: targetChatId, message: userMsg, user_id: userId }),
        signal: controller.signal
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunks = decoder.decode(value, { stream: true }).split('\n');
        for (const line of chunks) {
          if (line.startsWith('data: ')) {
            const token = line.substring(6);
            if (!token.startsWith('[ERROR]:')) {
              accumulated += token;
            }

            // SCOPED UPDATE: Always targets targetChatId regardless of activeChatId
            setChats(prev => prev.map(chat => 
              chat.chat_id === targetChatId 
                ? { 
                    ...chat, 
                    messages: chat.messages.map(m => 
                      m.id === 'streaming' ? { ...m, content: accumulated } : m
                    ) 
                  } 
                : chat
            ));
          }
        }
      }

      // Finalize messages (clean up 'streaming' id)
      setChats(prev => prev.map(chat => 
        chat.chat_id === targetChatId 
          ? { 
              ...chat, 
              loading: false,
              messages: chat.messages.map(m => m.id === 'streaming' ? { role: 'assistant', content: accumulated } : m)
            } 
          : chat
      ));
      
      fetchChats(); // Refresh titles/metadata

    } catch (error) {
      if (error.name === 'AbortError') return;
      logger.error('Chat error', { targetChatId, error: error.message });
      setChats(prev => prev.map(chat => 
        chat.chat_id === targetChatId 
          ? { ...chat, loading: false, messages: [...chat.messages.filter(m => m.id !== 'streaming'), { role: 'assistant', content: 'Connection Lost: ' + error.message }] } 
          : chat
      ));
    } finally {
      abortControllers.current.delete(targetChatId);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !activeChatId) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', activeChatId);
    formData.append('user_id', userId);

    setChats(prev => prev.map(c => 
      c.chat_id === activeChatId ? { ...c, loading: true, messages: [...c.messages, { role: 'user', content: `📎 Uploading: **${file.name}**...` }] } : c
    ));

    try {
      const resp = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
      if (resp.ok) {
        setChats(prev => prev.map(c => 
          c.chat_id === activeChatId ? { ...c, loading: false, messages: [...c.messages, { role: 'assistant', content: `✅ **${file.name}** processed.` }] } : c
        ));
      }
    } catch (err) {
      logger.error('Upload error', { err: err.message });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar 
        chats={chats} 
        activeChatId={activeChatId} 
        onSelect={selectChat} 
        onNew={startNewChat}
        onDelete={deleteChat}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      <div className="flex-1 flex flex-col min-w-0 relative h-full bg-[#020617]">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[130px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[130px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        <header className="relative z-30 flex items-center justify-between px-6 py-4 bg-slate-950/40 backdrop-blur-2xl border-b border-white/5">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2.5 -ml-2 text-slate-400 hover:text-white md:hidden transition-all bg-white/5 rounded-xl border border-white/5">
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: 15, scale: 1.05 }} className="w-11 h-11 rounded-2xl bg-futuristic-glow flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles size={24} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              </motion.div>
              <h1 className="text-2xl font-black tracking-tighter text-glow bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                AI Chatbot
              </h1>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 relative z-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto min-h-full flex flex-col">
            {!activeChatId || messages.length === 0 ? (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 flex flex-col items-center justify-center text-center py-16">
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse" />
                  <div className="relative w-32 h-32 rounded-[2.5rem] bg-slate-900/50 border border-indigo-500/20 flex items-center justify-center backdrop-blur-3xl shadow-2xl rotate-3">
                    <Zap size={56} className="text-indigo-400 filter drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full max-w-3xl pt-16">
                  {[
                    { title: "Neuro-Synthesis", desc: "Creative logic generation", icon: Sparkles },
                    { title: "Quantum Query", desc: "Complex data refactoring", icon: Zap },
                    { title: "Logic Mapping", desc: "System architecture design", icon: Cpu }
                  ].map((item, idx) => (
                    <div key={idx} className="p-6 rounded-3xl glass-card border-white/5 hover:border-indigo-500/40 transition-all cursor-pointer group hover:-translate-y-2 duration-500 text-left relative overflow-hidden">
                      <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                        <item.icon size={100} />
                      </div>
                      <p className="font-black text-white group-hover:text-indigo-400 transition-colors text-xs uppercase tracking-widest mb-1">{item.title}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase leading-tight">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <div className="space-y-6 pb-12">
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, idx) => (
                    <MessageItem key={msg.id || idx} msg={msg} isLast={idx === messages.length - 1} loading={isLoading} />
                  ))}
                </AnimatePresence>
                
                {isLoading && messages[messages.length - 1]?.content === '' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start mb-8">
                    <div className="flex gap-4 items-center">
                      <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-indigo-500/20 flex items-center justify-center shadow-lg">
                        <Cpu size={22} className="text-indigo-400 animate-spin-slow" />
                      </div>
                      <div className="glass-card px-6 py-5 rounded-3xl rounded-tl-none flex items-center space-x-3 shadow-xl">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} className="h-8" />
          </div>
        </main>

        <footer className="relative z-20 pb-10 pt-4 px-4 md:px-10">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={sendMessage} className="relative group transition-all duration-700">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-600/0 via-indigo-600/30 to-purple-600/0 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
              <div className="relative flex items-center bg-slate-900/80 backdrop-blur-3xl rounded-[1.8rem] p-2 pl-5 border border-white/10 shadow-2xl group-focus-within:border-indigo-500/50 transition-all overflow-hidden">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-2xl transition-all active:scale-90" title="Attach Context">
                  <Paperclip size={24} />
                </button>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.docx" />
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Initiate command sequence..." className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-600 py-5 px-4 focus:ring-0 focus:outline-none text-base md:text-lg font-medium" disabled={isLoading} />
                <button type="submit" disabled={!input.trim() || isLoading} className={`p-5 rounded-2xl flex items-center justify-center transition-all duration-700 ${input.trim() && !isLoading ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40' : 'bg-slate-800/50 text-slate-600 opacity-0 md:opacity-100'}`}>
                  <Send size={24} className={isLoading ? 'animate-pulse' : ''} />
                </button>
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
