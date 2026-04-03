import { useState, useCallback, useRef } from 'react';

export interface StreamMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface TraceEvent {
  type: string;
  data: unknown;
  timestamp: number;
}

export function useAgentStream(agentName: string) {
  const [messages, setMessages] = useState<StreamMessage[]>([]);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [partialResponse, setPartialResponse] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (input: string) => {
    if (loading) return;

    setLoading(true);
    setPartialResponse('');
    setMessages(prev => [...prev, { role: 'user', content: input, timestamp: Date.now() }]);
    setTrace([]);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`/api/agents/${agentName}/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; token?: string; content?: string; message?: string };
            setTrace(prev => [...prev, { type: event.type, data: event, timestamp: Date.now() }]);

            if (event.type === 'token' && event.token) {
              fullContent += event.token;
              setPartialResponse(fullContent);
            } else if (event.type === 'done' && event.content) {
              fullContent = event.content;
            }
          } catch { /* skip malformed */ }
        }
      }

      setMessages(prev => [...prev, { role: 'assistant', content: fullContent, timestamp: Date.now() }]);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${(error as Error).message}`, timestamp: Date.now() }]);
      }
    } finally {
      setLoading(false);
      setPartialResponse('');
    }
  }, [agentName, loading]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
    setTrace([]);
  }, []);

  return { messages, trace, loading, partialResponse, send, stop, clear };
}
