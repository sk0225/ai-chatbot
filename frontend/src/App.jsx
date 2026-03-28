import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Paperclip, Send, User, PlusCircle, Sparkles, Zap, Cpu } from 'lucide-react';
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
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    logger.info('App mounted', { userId, sessionId: sessionIdRef.current });
  }, [userId]);

  const startNewChat = useCallback(() => {
    sessionIdRef.current = crypto.randomUUID();
    setMessages([]);
    setInput('');
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
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
    <div className="flex flex-col h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4 bg-slate-950/50 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <motion.div 
            whileHover={{ rotate: 15, scale: 1.05 }}
            className="w-12 h-12 rounded-2xl bg-futuristic-glow flex items-center justify-center shadow-lg shadow-indigo-500/20"
          >
            <Sparkles size={26} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-glow bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400">
              CORTEX <span className="text-indigo-400">AI</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">Quantum Link Established</p>
            </div>
          </div>
        </div>



        <button
          onClick={startNewChat}
          className="group relative flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-all duration-300 active:scale-95"
        >
          <div className="absolute inset-0 bg-indigo-600/0 group-hover:bg-indigo-600/10 transition-colors rounded-xl" />
          <PlusCircle size={18} className="relative z-10 group-hover:rotate-90 transition-transform duration-500" />
          <span className="relative z-10 font-semibold text-sm">New Session</span>
        </button>
      </header>

      {/* Chat Space */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 custom-scrollbar">
        <div className="max-w-4xl mx-auto min-h-full flex flex-col">
          {messages.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-3xl rounded-full" />
                <div className="relative w-32 h-32 rounded-3xl bg-slate-900/50 border border-white/5 flex items-center justify-center backdrop-blur-3xl">
                   <Zap size={48} className="text-indigo-400 animate-pulse" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-bold text-white tracking-tight">Initiate Cognitive Link</h2>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                  I am a high-fidelity intelligence layer designed for complex reasoning and creative orchestration. How shall we proceed?
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl pt-8">
                {[
                  { title: "Quantum Analysis", desc: "Complex data processing" },
                  { title: "Neural Synthesis", desc: "Creative content generation" },
                  { title: "Logic Refactoring", desc: "Code optimization & debug" }
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-2xl glass-card border-white/5 hover:border-indigo-500/30 transition-all cursor-pointer group">
                    <p className="font-bold text-white group-hover:text-indigo-400 transition-colors">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <div className="space-y-2">
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
                  className="flex justify-start mb-6"
                >
                  <div className="flex gap-3 items-center">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-indigo-500/30 flex items-center justify-center">
                      <Cpu size={20} className="text-indigo-400 animate-spin-slow" />
                    </div>
                    <div className="glass-card px-5 py-4 rounded-2xl rounded-tl-none flex items-center space-x-2">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </main>

      {/* Control Interface */}
      <footer className="relative z-20 pb-8 pt-4 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <form 
            onSubmit={sendMessage} 
            className="relative group transition-all duration-500"
          >
            {/* Glow effect on focus */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-purple-500/0 rounded-3xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-700" />
            
            <div className="relative flex items-center glass-card rounded-2xl p-2 pl-4 border-white/5 overflow-hidden group-focus-within:border-indigo-500/40 transition-colors">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-500 hover:text-indigo-400 hover:bg-white/5 rounded-xl transition-all active:scale-90"
                title="Inject Context Data (PDF, TXT, DOCX)"
              >
                <Paperclip size={22} />
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
                placeholder="Synchronize request with Cortex..."
                className="flex-1 bg-transparent border-none text-slate-100 placeholder-slate-600 py-4 px-4 focus:ring-0 focus:outline-none text-lg"
                disabled={loading}
              />

              <button
                type="submit"
                disabled={!input.trim() || loading}
                className={`p-4 rounded-xl flex items-center justify-center transition-all duration-500 ${
                  input.trim() && !loading
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                    : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                }`}
              >
                <Send size={22} className={loading ? 'animate-pulse' : ''} />
              </button>
            </div>
          </form>
          

        </div>
      </footer>
    </div>
  );
}

export default App;
