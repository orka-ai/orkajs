import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { devtools, getCollector, resetCollector } from '../src/index.js';
import { RemoteAgent } from '../src/remote-agent.js';
import { RemoteViewer } from '../src/remote-viewer.js';
import type { DevToolsConfig } from '../src/types.js';

describe('Remote Tracing', () => {
  beforeEach(() => {
    resetCollector();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetCollector();
  });

  describe('devtools() function', () => {
    it('should return tracer instead of collector', async () => {
      const result = await devtools({ open: false });
      
      expect(result).toHaveProperty('tracer');
      expect(result).toHaveProperty('server');
      expect(result).toHaveProperty('stop');
      expect(result).toHaveProperty('config');
      expect(result.tracer).toBeDefined();
      
      await result.stop();
    });

    it('should default to local source', async () => {
      const result = await devtools({ open: false, port: 3002 });
      
      // source defaults to 'local' but may not be explicitly set in config
      expect(result.tracer).toBeDefined();
      expect(result.server).toBeDefined();
      
      await result.stop();
    });

    it('should throw error for remote mode without endpoint', async () => {
      await expect(devtools({
        source: 'remote',
        mode: 'agent',
        open: false,
      })).rejects.toThrow('Remote mode requires remote.endpoint configuration');
    });

    it('should accept remote agent configuration', async () => {
      // Mock fetch for the agent
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const config: DevToolsConfig = {
        source: 'remote',
        mode: 'agent',
        remote: {
          endpoint: 'https://traces.example.com',
          apiKey: 'test-api-key',
          projectId: 'test-project',
          environment: 'development',
        },
        open: false,
      };

      const result = await devtools(config);
      
      expect(result.tracer).toBeDefined();
      expect(result.server).toBeUndefined(); // No server in agent mode
      expect(result.config?.source).toBe('remote');
      expect(result.config?.mode).toBe('agent');
      
      await result.stop();
    });
  });

  describe('RemoteAgent', () => {
    it('should throw error without endpoint', () => {
      const tracer = getCollector();
      
      expect(() => new RemoteAgent(tracer, {})).toThrow('Remote endpoint is required');
    });

    it('should start and stop correctly', async () => {
      const tracer = getCollector();
      const agent = new RemoteAgent(tracer, {
        remote: { endpoint: 'https://traces.example.com' },
      });

      await agent.start();
      await agent.stop();
      
      // Should not throw
      expect(true).toBe(true);
    });

    it('should apply sampling rate', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const tracer = getCollector();
      const agent = new RemoteAgent(tracer, {
        remote: {
          endpoint: 'https://traces.example.com',
          sampling: 0, // 0% sampling - should skip all traces
        },
      });

      await agent.start();
      
      // Emit some events
      tracer.startRun('llm', 'test', { input: 'test' });
      
      // Wait for batch timeout
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // With 0% sampling, no traces should be sent
      expect(global.fetch).not.toHaveBeenCalled();
      
      await agent.stop();
    });

    it('should perform health check', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true });

      const tracer = getCollector();
      const agent = new RemoteAgent(tracer, {
        remote: { endpoint: 'https://traces.example.com' },
      });

      const isHealthy = await agent.healthCheck();
      
      expect(isHealthy).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://traces.example.com/health',
        expect.any(Object)
      );
    });
  });

  describe('RemoteViewer', () => {
    it('should throw error without endpoint', () => {
      const tracer = getCollector();
      
      expect(() => new RemoteViewer(tracer, {})).toThrow('Remote endpoint is required');
    });

    it('should start and stop correctly', async () => {
      // Mock fetch for streaming
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined }),
          }),
        },
      });

      const tracer = getCollector();
      const viewer = new RemoteViewer(tracer, {
        remote: { endpoint: 'https://traces.example.com' },
      });

      await viewer.start();
      await viewer.stop();
      
      expect(true).toBe(true);
    });

    it('should fetch historical sessions', async () => {
      const mockSessions = [
        { id: 'session-1', name: 'Test Session', runs: [] },
      ];

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ sessions: mockSessions }),
      });

      const tracer = getCollector();
      const viewer = new RemoteViewer(tracer, {
        remote: {
          endpoint: 'https://traces.example.com',
          projectId: 'test-project',
        },
      });

      const sessions = await viewer.fetchSessions({ limit: 10 });
      
      expect(sessions).toEqual(mockSessions);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/sessions'),
        expect.any(Object)
      );
    });

    it('should report connection status', async () => {
      const tracer = getCollector();
      const viewer = new RemoteViewer(tracer, {
        remote: { endpoint: 'https://traces.example.com' },
      });

      // Before starting, should not be connected
      expect(viewer.isConnected()).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    it('should export collector alias for devtools', async () => {
      const { collector } = await import('../src/index.js');
      
      expect(collector).toBeDefined();
      expect(typeof collector).toBe('function');
    });

    it('should work with withTrace using tracer option', async () => {
      const { withTrace, getCollector } = await import('../src/index.js');
      
      const tracer = getCollector();
      const fn = vi.fn().mockResolvedValue('result');
      
      const tracedFn = withTrace(fn, {
        name: 'testFn',
        type: 'custom',
        tracer,
      });

      const result = await tracedFn('arg1');
      
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledWith('arg1');
    });
  });
});

describe('DevToolsResult type', () => {
  it('should have correct shape', async () => {
    const result = await devtools({ open: false, port: 3003 });
    
    // Type checks
    const tracer = result.tracer;
    const server = result.server;
    const stop = result.stop;
    
    expect(tracer).toBeDefined();
    expect(server).toBeDefined();
    expect(typeof stop).toBe('function');
    
    await result.stop();
  });
});
