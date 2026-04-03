import { useState, useEffect } from 'react';
import { AgentPlayground } from './components/AgentPlayground';
import { TracePanel } from './components/TracePanel';
import { useAgentStream } from './hooks/useAgentStream';

interface AgentInfo {
  name: string;
  goal: string;
}

const styles: Record<string, React.CSSProperties> = {
  app: { display: 'flex', height: '100vh', overflow: 'hidden' },
  sidebar: { width: '220px', background: '#0a0e1a', borderRight: '1px solid #1e293b', display: 'flex', flexDirection: 'column' },
  sidebarHeader: { padding: '16px', borderBottom: '1px solid #1e293b' },
  logo: { color: '#3b82f6', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' },
  tagline: { color: '#475569', fontSize: '11px', marginTop: '2px' },
  agentList: { flex: 1, overflowY: 'auto', padding: '8px' },
  agentItem: (active: boolean) => ({
    padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', marginBottom: '2px',
    background: active ? '#1e293b' : 'transparent',
    color: active ? '#e2e8f0' : '#94a3b8',
    fontSize: '13px', fontWeight: active ? 600 : 400,
    transition: 'all 0.1s',
  }),
  main: { flex: 1, display: 'flex', overflow: 'hidden' },
  chat: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  tracePanel: { width: '280px', background: '#0a0e1a', borderLeft: '1px solid #1e293b', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  traceHeader: { padding: '12px 16px', borderBottom: '1px solid #1e293b', color: '#64748b', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
};

function AgentWrapper({ agentName }: { agentName: string }) {
  const { trace } = useAgentStream(agentName);
  return (
    <>
      <div style={styles.chat}>
        <AgentPlayground agentName={agentName} />
      </div>
      <div style={styles.tracePanel}>
        <div style={styles.traceHeader}>Trace</div>
        <TracePanel events={trace} />
      </div>
    </>
  );
}

// Workaround: TracePanel needs the same hook instance as AgentPlayground
// So we lift state — this simplified version passes trace from playground
function App() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then((data: { agents: AgentInfo[] }) => {
        setAgents(data.agents ?? []);
        if (data.agents?.length > 0 && !selected) {
          setSelected(data.agents[0].name);
        }
      })
      .catch(() => {
        // Dev mode: show dummy agent if API not reachable
      });
  }, []);

  return (
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <div style={styles.logo}>⬡ Orka</div>
          <div style={styles.tagline}>Dev Server</div>
        </div>
        <div style={styles.agentList}>
          {agents.length === 0 && (
            <div style={{ color: '#475569', fontSize: '12px', padding: '8px 10px' }}>No agents found</div>
          )}
          {agents.map(a => (
            <div
              key={a.name}
              style={styles.agentItem(selected === a.name)}
              onClick={() => setSelected(a.name)}
            >
              {a.name}
            </div>
          ))}
        </div>
      </div>
      <div style={styles.main}>
        {selected
          ? <AgentWrapper agentName={selected} />
          : <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>Select an agent</div>
        }
      </div>
    </div>
  );
}

export default App;
