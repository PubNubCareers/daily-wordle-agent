import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { decodeInlineArtifact, TaskClient, textPart } from '@blocks-network/sdk';

const PORT = Number(process.env.PORT ?? 4173);
const HOST = process.env.RENDER ? '0.0.0.0' : '127.0.0.1';
const PUBLIC_DIR = join(process.cwd(), 'public');
const AGENT_NAME = 'daily_wordle_agent';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (request, response) => {
  try {
    if (request.method === 'POST' && request.url === '/api/wordle') {
      const body = await readJson(request);
      const result = await callWordleAgent(body);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === 'GET') {
      await serveStatic(request, response);
      return;
    }

    sendJson(response, 405, { error: 'Method not allowed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Something went wrong.';
    sendJson(response, 500, { error: message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Daily Wordle game: http://localhost:${PORT}`);
});

async function callWordleAgent(payload) {
  if (!process.env.BLOCKS_API_KEY) {
    throw new Error('Missing BLOCKS_API_KEY. Run blocks publish first so Blocks creates your .env file.');
  }

  const client = await TaskClient.create({
    billingMode: 'free',
    apiKey: process.env.BLOCKS_API_KEY,
  });

  const session = await client.sendMessage({
    agentName: AGENT_NAME,
    requestParts: [textPart(JSON.stringify(payload), 'request')],
  });

  try {
    const artifacts = [];

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for the Wordle agent.'));
      }, 30000);

      session.onArtifact(async (event) => {
        try {
          artifacts.push(await readArtifact(session, event.artifactRef));
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      session.onTerminal((event) => {
        clearTimeout(timeout);
        if (event.state === 'failed') {
          reject(new Error(event.error ?? 'The Wordle agent failed.'));
          return;
        }
        resolve();
      });
    });

    const output = artifacts.at(-1);
    if (!output) {
      throw new Error('The Wordle agent did not return a result.');
    }

    return JSON.parse(output);
  } finally {
    session.close();
    client.destroy();
  }
}

async function readArtifact(session, ref) {
  if (ref.kind === 'inline' && ref.data) {
    return new TextDecoder().decode(decodeInlineArtifact(ref));
  }

  const downloaded = await session.downloadArtifact(ref);
  return new TextDecoder().decode(downloaded.data);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : {};
}

async function serveStatic(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const rawPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(PUBLIC_DIR, rawPath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  try {
    const data = await readFile(filePath);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(filePath)] ?? 'application/octet-stream',
    });
    response.end(data);
  } catch {
    sendJson(response, 404, { error: 'Not found' });
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}
