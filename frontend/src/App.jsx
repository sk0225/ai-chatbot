import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Paperclip, Send, User, PlusCircle, Sparkles, Zap, Cpu, Trash2, Menu, X, MessageSquare } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import logger from './utils/logger';

const Message = ({ msg, isLast, loading }) => {
  const isBot = msg.sender === 'bot';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-6 w-full`}
    >
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isBot ? 'flex-row' : 'flex-row-reverse'} items-start gap-3`}>
        <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
          isBot 
            ? 'bg-slate-900 border border-indigo-500/30 text-indigo-400' 
            : 'bg-indigo-600 text-white shadow-indigo-600/20'
        }`}>
          {isBot ? <Cpu size={20} /> : <User size={20} />}
        </div>
        
        <div className={`relative px-5 py-3.5 rounded-2xl transition-all duration-300 ${
          isBot
            ? 'glass-card text-slate-200 rounded-tl-none border-indigo-500/10'
            : 'bg-indigo-600 text-white rounded-tr-none shadow-xl shadow-indigo-600/10'
        }`}>
          <div className="prose prose-invert max-w-none">
            <ReactMarkdown>{msg.text}</ReactMarkdown>
          </div>
          
          {isBot && isLast && loading && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
          )}
          
          {/* Subtle glow for bot messages */}
          {isBot && (
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-indigo-500/5 to-purple-500/5 pointer-events-none" />
          )}
        </div>
      </div>
    </motion.div>
  );
};

function App() {
  const [chats, setChats] = useState(() => {
    const saved = localStorage.getItem('cortex_chats');
    return saved ? JSON.parse(saved) : [];
  });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const sessionIdRef = useRef(crypto.randomUUID());

  const userId = useMemo(() => {
    let id = localStorage.getItem('gemini_user_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('gemini_user_id', id);
    }
    return id;
  }, []);

  // Sync chats to localStorage
  useEffect(() => {
    localStorage.setItem('cortex_chats', JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    logger.info('App mounted', { userId, sessionId: sessionIdRef.current });
  }, [userId]);

  const startNewChat = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setInput('');
    setIsSidebarOpen(false);
  }, []);

  const selectChat = useCallback((chat) => {
    sessionIdRef.current = chat.id;
    setMessages(chat.messages);
    setIsSidebarOpen(false);
  }, []);

  const deleteChat = useCallback((e, chatId) => {
    e.stopPropagation();
    const updatedChats = chats.filter(c => c.id !== chatId);
    setChats(updatedChats);
    if (sessionIdRef.current === chatId) {
      startNewChat();
    }
  }, [chats, startNewChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Sync current messages to the chats list
  useEffect(() => {
    if (messages.length === 0) return;

    setChats(prev => {
      const existingIdx = prev.findIndex(c => c.id === sessionIdRef.current);
      const firstUserMsg = messages.find(m => m.sender === 'user')?.text || '';
      const title = existingIdx >= 0 
        ? prev[existingIdx].title 
        : (firstUserMsg.substring(0, 40) + (firstUserMsg.length > 40 ? '...' : '') || 'New Chat');

      const updatedChat = {
        id: sessionIdRef.current,
        title: title,
        messages: messages,
        updatedAt: Date.now()
      };

      if (existingIdx >= 0) {
        // Only update if messages have changed to avoid loops
        if (JSON.stringify(prev[existingIdx].messages) === JSON.stringify(messages)) {
          return prev;
        }
        const newChats = [...prev];
        newChats[existingIdx] = updatedChat;
        return newChats.sort((a, b) => b.updatedAt - a.updatedAt);
      } else {
        return [updatedChat, ...prev];
      }
    });
  }, [messages]);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('session_id', sessionIdRef.current);
    formData.append('user_id', userId);

    logger.info('Starting file upload', { fileName: file.name, fileSize: file.size });
    setLoading(true);
    setMessages((prev) => [...prev, { sender: 'user', text: `📎 Uploading: **${file.name}**...` }]);

    try {
      const response = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        logger.info('File upload successful', { fileName: file.name });
        setMessages((prev) => [...prev, { sender: 'bot', text: `✅ **${file.name}** processed successfully. I've integrated its data into my vector-memory. You can now query this information.` }]);
      } else {
        logger.error('File upload failed', { fileName: file.name, error: data.error });
        setMessages((prev) => [...prev, { sender: 'bot', text: `❌ Upload failed: ${data.error || 'Unknown error'}` }]);
      }
    } catch (error) {
      logger.error('File upload connection error', { fileName: file.name, message: error.message });
      setMessages((prev) => [...prev, { sender: 'bot', text: '❌ Connection error: ' + error.message }]);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    logger.info('Sending chat message', { messageLength: userMsg.length });
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);

    // Initialise empty bot response
    setMessages((prev) => [...prev, { sender: 'bot', text: '' }]);

    try {
      const response = await fetch('http://localhost:5001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          session_id: sessionIdRef.current,
          user_id: userId,
        }),
      });

      if (!response.ok) {
        logger.error(`Chat HTTP error: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

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
            if (token.startsWith('[ERROR]:')) {
              const errMsg = token.replace('[ERROR]:', '');
              logger.error('Chat stream token error', { message: errMsg });
              accumulated = `Error: ${errMsg}`;
            } else {
              accumulated += token;
            }

            setMessages((prev) => {
              const updated = [...prev];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].sender === 'bot') {
                  updated[i].text = accumulated;
                  break;
                }
              }
              return updated;
            });
          }
        }
      }
    } catch (error) {
      logger.error('Critical chat error', { message: error.message });
      setMessages((prev) => [...prev, { sender: 'bot', text: 'Critical connection loss: ' + error.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - Fixed w-64 width */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-64 bg-slate-950 border-r border-white/5 flex flex-col transition-transform duration-300 ease-in-out ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full w-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-white/5 md:border-none">
            <button
              onClick={startNewChat}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all duration-300 group shadow-lg shadow-indigo-600/10"
            >
              <PlusCircle size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              <span className="font-bold text-sm">New Chat</span>
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-2">Previous Intelligence Linkages</p>
            {chats.length > 0 ? (
              chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => selectChat(chat)}
                  className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    sessionIdRef.current === chat.id
                      ? 'bg-indigo-600/20 border border-indigo-500/20 text-white'
                      : 'hover:bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <MessageSquare size={16} className={sessionIdRef.current === chat.id ? 'text-indigo-400' : 'text-slate-500'} />
                  <span className="flex-1 truncate text-xs font-semibold">{chat.title}</span>
                  <button
                    onClick={(e) => deleteChat(e, chat.id)}
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
                <p className="text-[10px] font-black uppercase tracking-widest">Temporal Void</p>
              </div>
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/5 bg-slate-950/80">
            <div className="flex items-center gap-3 px-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black shadow-inner">
                {userId.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-200 truncate tracking-tight">Cortex Pilot</p>
                <p className="text-[9px] text-slate-500 truncate uppercase animate-pulse">Neural Link Active</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Chat Area - flex-1 takes remaining space */}
      <div className="flex-1 flex flex-col min-w-0 relative h-full bg-[#020617]">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[130px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[130px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
        </div>

        {/* Header */}
        <header className="relative z-30 flex items-center justify-between px-6 py-4 bg-slate-950/40 backdrop-blur-2xl border-b border-white/5">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2.5 -ml-2 text-slate-400 hover:text-white md:hidden transition-all bg-white/5 rounded-xl border border-white/5 active:scale-95"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-3">
              <motion.div 
                whileHover={{ rotate: 15, scale: 1.05 }}
                className="w-11 h-11 rounded-2xl bg-futuristic-glow flex items-center justify-center shadow-lg shadow-indigo-500/20"
              >
                <Sparkles size={24} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-black tracking-tighter text-glow bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
                  CORTEX <span className="text-indigo-400">AI</span>
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  <p className="text-[9px] text-slate-500 font-black uppercase tracking-[0.2em]">Quantum Link Sync</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden lg:flex flex-col items-end">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-right">Processing Core</p>
                <p className="text-[9px] text-indigo-500/70 font-bold uppercase tracking-tighter">v3.0 Quantum Stable</p>
             </div>
             <div className="w-px h-8 bg-white/10 hidden lg:block"></div>
             <button
                onClick={startNewChat}
                className="p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all duration-500 md:px-6 md:flex md:items-center md:gap-3 hover:bg-white/10 active:scale-95 shadow-xl"
              >
                <PlusCircle size={20} className="md:group-hover:rotate-90 transition-transform" />
                <span className="hidden md:inline font-black text-xs uppercase tracking-widest">Recalibrate</span>
              </button>
          </div>
        </header>

        {/* Chat Messages */}
        <main className="flex-1 overflow-y-auto p-4 md:p-10 relative z-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto min-h-full flex flex-col">
            {messages.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center justify-center text-center py-16"
              >
                <div className="relative mb-10">
                  <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] rounded-full animate-pulse" />
                  <div className="relative w-32 h-32 rounded-[2.5rem] bg-slate-900/50 border border-indigo-500/20 flex items-center justify-center backdrop-blur-3xl shadow-2xl rotate-3">
                     <Zap size={56} className="text-indigo-400 filter drop-shadow-[0_0_15px_rgba(129,140,248,0.5)]" />
                  </div>
                </div>
                <div className="space-y-4 max-w-2xl px-6">
                  <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight uppercase italic">Cognitive<br /><span className="text-indigo-500 tracking-[-0.05em] not-italic">Synchronisation</span></h2>
                  <p className="text-slate-400 leading-relaxed text-sm md:text-lg font-medium">
                    Neural path established. Ready for complex logic orchestration, data synthesis, and creative resonance. How shall we expand?
                  </p>
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
                  {messages.map((msg, index) => (
                    <Message 
                      key={index} 
                      msg={msg} 
                      isLast={index === messages.length - 1}
                      loading={loading}
                    />
                  ))}
                </AnimatePresence>
                
                {loading && messages[messages.length-1].text === '' && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start mb-8"
                  >
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

        {/* Footer / Input Box */}
        <footer className="relative z-20 pb-10 pt-4 px-4 md:px-10">
          <div className="max-w-4xl mx-auto">
            <form 
              onSubmit={sendMessage} 
              className="relative group transition-all duration-700"
            >
              <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-600/0 via-indigo-600/30 to-purple-600/0 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
              
              <div className="relative flex items-center bg-slate-900/80 backdrop-blur-3xl rounded-[1.8rem] p-2 pl-5 border border-white/10 shadow-2xl group-focus-within:border-indigo-500/50 transition-all overflow-hidden">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-2xl transition-all active:scale-90"
                  title="Inject Context Architecture"
                >
                  <Paperclip size={24} />
                </button>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                  accept=".pdf,.txt,.docx"
                />
  
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Initiate command sequence..."
                  className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-600 py-5 px-4 focus:ring-0 focus:outline-none text-base md:text-lg font-medium"
                  disabled={loading}
                />
  
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className={`p-5 rounded-2xl flex items-center justify-center transition-all duration-700 ${
                    input.trim() && !loading
                      ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40 hover:shadow-indigo-600/60 hover:-translate-y-1 active:translate-y-0 active:scale-95'
                      : 'bg-slate-800/50 text-slate-600 cursor-not-allowed invisible md:visible'
                  }`}
                >
                  <Send size={24} className={loading ? 'animate-pulse' : ''} />
                </button>
              </div>
            </form>
            <p className="text-[9px] text-center text-slate-600 font-bold uppercase tracking-[0.3em] mt-6">Cortex Intelligence Layer • Neural Integration v3.0</p>
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
