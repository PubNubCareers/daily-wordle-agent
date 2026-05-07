import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

const PORT = Number(process.env.PORT ?? 10000);
const HOST = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';

let runnerStatus = 'starting';
let lastOutput = '';

const server = createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({
    service: 'daily-wordle-agent-runner',
    status: runnerStatus,
    lastOutput,
  }));
});

server.listen(PORT, HOST, () => {
  console.log(`Runner health check listening on http://localhost:${PORT}`);
  startBlocksRunner();
});

function startBlocksRunner() {
  const command = process.env.BLOCKS_COMMAND ?? `${homedir()}/.blocks/bin/blocks`;
  const args = ['run'];
  const child = spawn(command, args, {
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    lastOutput = text.trim().slice(-500);
    if (text.includes('running') || text.includes('Registered agent')) {
      runnerStatus = 'running';
    }
    process.stdout.write(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    lastOutput = text.trim().slice(-500);
    runnerStatus = 'error';
    process.stderr.write(text);
  });

  child.on('exit', (code) => {
    runnerStatus = `exited:${code}`;
    console.log(`blocks run exited with code ${code}. Restarting in 5 seconds...`);
    setTimeout(startBlocksRunner, 5000);
  });
}
