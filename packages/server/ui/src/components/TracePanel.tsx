import { useState } from 'react';
import type { TraceEvent } from '../hooks/useAgentStream';

const TYPE_COLORS: Record<string, string> = {
  token: '#64748b',
  tool_call: '#f59e0b',
  tool_result: '#10b981',
  done: '#3b82f6',
  error: '#ef4444',
  usage: '#8b5cf6',
};

export function TracePanel({ events }: { events: TraceEvent[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (events.length === 0) {
    return (
      <div style={{ padding: '24px', color: '#475569', textAlign: 'center', fontSize: '13px' }}>
        No trace events yet
      </div>
    );
  }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {events.filter(e => e.type !== 'token' && e.type !== 'content').map((event, i) => (
        <div
          key={i}
          onClick={() => setExpanded(expanded === i ? null : i)}
          style={{
            padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #1e293b',
            borderLeft: `3px solid ${TYPE_COLORS[event.type] ?? '#475569'}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: TYPE_COLORS[event.type] ?? '#e2e8f0', fontWeight: 600, fontSize: '12px' }}>
              {event.type}
            </span>
            <span style={{ color: '#475569', fontSize: '11px' }}>
              {new Date(event.timestamp).toLocaleTimeString()}
            </span>
          </div>
          {expanded === i && (
            <pre style={{ marginTop: '8px', fontSize: '11px', color: '#94a3b8', overflow: 'auto', maxHeight: '200px' }}>
              {JSON.stringify(event.data, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}
