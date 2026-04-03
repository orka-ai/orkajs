import { runInit } from './commands/init.js';
import { runDev } from './commands/dev.js';

const [,, command, ...args] = process.argv;

async function main() {
  switch (command) {
    case 'init': {
      await runInit(args[0]);
      break;
    }
    case 'dev': {
      const portFlag = args.findIndex(a => a === '--port' || a === '-p');
      const port = portFlag !== -1 ? parseInt(args[portFlag + 1]) : undefined;
      const open = !args.includes('--no-open');
      await runDev({ port, open });
      break;
    }
    default: {
      console.log(`
  orka — OrkaJS CLI

  Commands:
    orka init [dir]          Create a new OrkaJS project
    orka dev [--port 4200]   Start the dev server

  Examples:
    npx @orka-js/cli init ./my-agent
    npx @orka-js/cli dev --port 3000
`);
      break;
    }
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
