import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

function startNode(name: string, scriptFile: string) {
  const root = join(__dirname, '..');
  const tsPath = join(__dirname, scriptFile);
  const jsPath = join(__dirname, scriptFile.replace(/\.ts$/, '.js'));
  const isDev = existsSync(tsPath);

  const cmd = 'node';
  const args = isDev
    ? [join(root, 'node_modules', 'ts-node', 'dist', 'bin.js'), tsPath]
    : [jsPath];

  const proc = spawn(cmd, args, {
    cwd: root,
    stdio: 'pipe',
    env: process.env,
  });

  proc.stdout.on('data', (data: Buffer) => {
    console.log(`[${name}] ${data.toString().trim()}`);
  });

  proc.stderr.on('data', (data: Buffer) => {
    console.error(`[${name}] ${data.toString().trim()}`);
  });

  proc.on('close', (code: number | null) => {
    console.log(`[${name}] exited with code ${code}`);
  });

  return proc;
}

const bot = startNode('Bot', 'index.ts');
const dashboard = startNode('Dashboard', 'dashboard/server.ts');

process.on('SIGINT', () => {
  bot.kill();
  dashboard.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  bot.kill();
  dashboard.kill();
  process.exit(0);
});
