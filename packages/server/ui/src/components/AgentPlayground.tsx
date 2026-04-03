import { useState, useRef, useEffect } from 'react';
import { useAgentStream } from '../hooks/useAgentStream';

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', flexDirection: 'column', height: '100%' },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' },
  message: (role: string) => ({
    maxWidth: '80%',
    alignSelf: role === 'user' ? 'flex-end' : 'flex-start',
    background: role === 'user' ? '#3b82f6' : '#1e293b',
    color: '#e2e8f0',
    padding: '10px 14px',
    borderRadius: '12px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
  partial: {
    alignSelf: 'flex-start',
    background: '#1e293b',
    color: '#94a3b8',
    padding: '10px 14px',
    borderRadius: '12px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  inputRow: { display: 'flex', gap: '8px', padding: '12px', borderTop: '1px solid #1e293b' },
  input: {
    flex: 1, background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0',
    borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none',
  },
  btn: (variant: string) => ({
    background: variant === 'stop' ? '#ef4444' : '#3b82f6',
    color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 16px',
    cursor: 'pointer', fontWeight: 600, fontSize: '14px',
  }),
};

export function AgentPlayground({ agentName }: { agentName: string }) {
  const [input, setInput] = useState('');
  const { messages, loading, partialResponse, send, stop, clear } = useAgentStream(agentName);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partialResponse]);

  const handleSubmit = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    send(text);
  };

  return (
    <div style={styles.container}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, color: '#94a3b8', fontSize: '13px' }}>Agent: {agentName}</span>
        <button onClick={clear} style={{ ...styles.btn('clear'), background: 'transparent', color: '#64748b', fontSize: '12px' }}>Clear</button>
      </div>
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={styles.message(msg.role)}>{msg.content}</div>
        ))}
        {loading && partialResponse && (
          <div style={styles.partial}>{partialResponse}<span style={{ animation: 'blink 1s infinite' }}>▋</span></div>
        )}
        {loading && !partialResponse && (
          <div style={styles.partial}>Thinking…</div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={styles.inputRow}>
        <input
          style={styles.input}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          placeholder={`Message ${agentName}…`}
          disabled={loading}
        />
        {loading
          ? <button onClick={stop} style={styles.btn('stop')}>Stop</button>
          : <button onClick={handleSubmit} style={styles.btn('send')} disabled={!input.trim()}>Send</button>
        }
      </div>
    </div>
  );
}
