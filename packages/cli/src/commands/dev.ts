import { intro, outro, spinner, log } from '@clack/prompts';
import { join } from 'path';
import fs from 'fs-extra';

export interface DevOptions {
  port?: number;
  open?: boolean;
}

export async function runDev(options: DevOptions = {}) {
  intro('Orka Dev Server');

  const port = options.port ?? 4200;
  const cwd = process.cwd();

  // Look for agent config
  const configPaths = [
    join(cwd, 'orka.config.ts'),
    join(cwd, 'orka.config.js'),
    join(cwd, 'src', 'agent.ts'),
    join(cwd, 'src', 'agents.ts'),
  ];

  let configFile: string | null = null;
  for (const p of configPaths) {
    if (await fs.pathExists(p)) {
      configFile = p;
      break;
    }
  }

  if (!configFile) {
    log.error('No agent config found. Create orka.config.ts or src/agent.ts');
    log.info('Expected export: export default { agents: { assistant: myAgent } }');
    process.exit(1);
  }

  const s = spinner();
  s.start(`Loading agents from ${configFile}…`);

  try {
    // Dynamic import with ts-node/esm support
    const mod = await import(configFile) as {
      default?: { agents: Record<string, unknown> };
      agents?: Record<string, unknown>;
    };
    const agentConfig = mod.default ?? mod;
    const agents = (agentConfig as { agents?: Record<string, unknown> }).agents ?? {};

    s.stop(`Loaded ${Object.keys(agents).length} agent(s)`);

    // Import and start the server
    const { createOrkaServer } = await import('@orka-js/server');
    const server = await createOrkaServer({
      agents: agents as Record<string, import('@orka-js/agent').BaseAgent>,
      port,
      open: options.open ?? true,
    });

    outro(`Orka Dev Server running at ${server.url}`);
    log.info('Press Ctrl+C to stop.');

    // Keep alive
    process.on('SIGINT', async () => {
      await server.close();
      process.exit(0);
    });
  } catch (error) {
    s.stop('Failed to start server');
    log.error((error as Error).message);
    process.exit(1);
  }
}
