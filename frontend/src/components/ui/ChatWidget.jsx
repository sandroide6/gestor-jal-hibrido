import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { readCsrfCookie } from '../../services/api';

const BASE_URL = import.meta.env.VITE_API_URL || '';

function TypingDots() {
  return (
    <span className="inline-flex gap-1 items-center py-0.5">
      {[0, 150, 300].map(d => (
        <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function Message({ msg, isLast, loading }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-jal-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 001.5 2.122m-6 0a2.25 2.25 0 002.5 0M12 12.75a2.25 2.25 0 002.25 2.25h3.75m-12 0h3.75m0 0a2.25 2.25 0 012.25 2.25V19.5" />
          </svg>
        </div>
      )}
      <div className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-jal-blue-600 text-white rounded-tr-none'
          : 'bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100'
      }`}>
        {msg.content
          ? msg.content
          : isLast && loading
            ? <TypingDots />
            : null}
      </div>
    </div>
  );
}
Message.propTypes = {
  msg: PropTypes.shape({ role: PropTypes.string, content: PropTypes.string }).isRequired,
  isLast: PropTypes.bool,
  loading: PropTypes.bool,
};

const WELCOME = { role: 'assistant', content: '¡Hola! Soy el asistente del Gestor JAL. Puedo ayudarte a usar el sistema, generar documentos y responder preguntas sobre la JAL. ¿En qué te puedo ayudar?' };

export default function ChatWidget() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');

    const history = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setLoading(true);

    try {
      // Fix: este fetch es directo (no pasa por services/api.js) y antes dependía
      // solo del header Authorization con el token guardado en el store — desde que
      // el access token vive en una cookie httpOnly, hace falta credentials:'include'
      // (para que el navegador la adjunte) y el header CSRF (esto es un POST).
      const csrfToken = readCsrfCookie();
      const res = await fetch(`${BASE_URL}/chat`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Error ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6);
          if (raw === '[DONE]') break;
          try {
            const chunk = JSON.parse(raw);
            if (chunk.error) throw new Error(chunk.error);
            if (chunk.text) {
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + chunk.text };
                return copy;
              });
            }
          } catch (e) {
            if (e.message !== 'JSON parse') throw e;
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: err.message || 'Error de conexión. Intenta de nuevo.' };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  }

  function clear() {
    setMessages([WELCOME]);
    setInput('');
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ height: '480px' }}>

          {/* Header */}
          <div className="bg-jal-blue-600 px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold leading-tight">Asistente JAL</p>
              <p className="text-jal-blue-200 text-xs">IA local · llama3.2</p>
            </div>
            <button onClick={clear} title="Nueva conversación"
              className="text-white/60 hover:text-white p-1 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={() => setOpen(false)} title="Cerrar"
              className="text-white/60 hover:text-white p-1 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} isLast={i === messages.length - 1} loading={loading} />
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-3 bg-white border-t border-gray-100 flex-shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Escribe tu pregunta…"
                disabled={loading}
                className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-jal-blue-400 focus:border-transparent disabled:opacity-50 bg-white"
              />
              <button onClick={send} disabled={loading || !input.trim()}
                className="w-9 h-9 bg-jal-blue-600 hover:bg-jal-blue-700 disabled:opacity-40 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5 text-center">IA local · respuestas pueden tomar unos segundos</p>
          </div>
        </div>
      )}

      {/* FAB */}
      <button onClick={() => setOpen(v => !v)} aria-label="Asistente IA"
        className="w-14 h-14 bg-jal-blue-600 hover:bg-jal-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95">
        {open
          ? <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          : <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
        }
      </button>
    </div>
  );
}
