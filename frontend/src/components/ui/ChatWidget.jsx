import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { readCsrfCookie } from '../../services/api';
import Icon from './Icon';
import Spinner from './Spinner';

const BASE_URL = import.meta.env.VITE_API_URL || '';

// Indicador de espera sin rebote: el texto dice lo que pasa y el lector de pantalla lo anuncia.
function Typing() {
  return (
    <span className="inline-flex items-center gap-2 text-ink-muted" role="status">
      <Spinner />Escribiendo…
    </span>
  );
}

function Message({ msg, isLast, loading }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] rounded-lg px-3.5 py-2.5 leading-relaxed whitespace-pre-wrap ${
        isUser
          ? 'bg-brand text-white rounded-br-sm'
          : 'bg-surface text-ink border border-line rounded-bl-sm'
      }`}>
        <span className="sr-only">{isUser ? 'Tú: ' : 'Asistente: '}</span>
        {msg.content
          ? msg.content
          : isLast && loading
            ? <Typing />
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

      for (;;) {
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
    // Encima de la barra inferior en móvil; en escritorio, esquina inferior derecha
    <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-5 lg:right-5">
      {open && (
        <section
          aria-label="Asistente"
          className="anim-pop origin-bottom-right flex h-[min(480px,calc(100dvh-9rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-float sm:w-96"
        >
          <header className="flex flex-shrink-0 items-center gap-3 bg-brand px-4 py-3 text-white">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold leading-tight">Asistente</h2>
              <p className="text-sm text-brand-100">Responde dudas sobre el uso del sistema</p>
            </div>
            <button type="button" onClick={clear} className="rounded-md px-2 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/10 hover:text-white">
              Nueva conversación
            </button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente" className="rounded-md p-1.5 text-white/85 hover:bg-white/10 hover:text-white">
              <Icon name="cerrar" size={20} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-bg p-3" aria-live="polite">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} isLast={i === messages.length - 1} loading={loading} />
            ))}
            <div ref={bottomRef} />
          </div>

          <form
            className="flex-shrink-0 border-t border-line bg-surface p-3"
            onSubmit={(e) => { e.preventDefault(); send(); }}
          >
            <label htmlFor="chat-input" className="sr-only">Tu pregunta</label>
            <div className="flex gap-2">
              <input
                id="chat-input"
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Escribe tu pregunta…"
                disabled={loading}
                className="input min-h-[44px] flex-1"
                autoComplete="off"
              />
              <button type="submit" disabled={loading || !input.trim()} className="btn-primary min-h-[44px] px-4">
                Enviar
              </button>
            </div>
            <p className="mt-1.5 text-center text-sm text-ink-muted">Las respuestas pueden tardar unos segundos. Verifica los datos importantes.</p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-label={open ? 'Cerrar asistente' : 'Abrir asistente'}
        className="chat-fab flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-float hover:bg-brand-hover"
      >
        <Icon name={open ? 'cerrar' : 'ayuda'} size={26} />
      </button>
    </div>
  );
}
