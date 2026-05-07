import type { HandlerResult, StartTaskMessage, TaskContext } from '@blocks-network/sdk';
import { handleDailyWordle } from './src/dailyWordleAgent.js';

export default async function handler(
  task: StartTaskMessage,
  ctx?: TaskContext,
): Promise<HandlerResult> {
  ctx?.reportStatus('Playing Daily Wordle...');

  const input = parseInput(task);
  const result = handleDailyWordle(input);

  return {
    artifacts: [
      {
        data: JSON.stringify(result, null, 2),
        mimeType: 'application/json',
      },
    ],
  };
}

function parseInput(task: StartTaskMessage): Record<string, unknown> {
  const requestPart = task.requestParts?.[0] as Record<string, unknown> | undefined;
  const text = typeof requestPart?.text === 'string' ? requestPart.text : undefined;

  if (!text || !text.trim()) {
    return parseStructuredInput(task, requestPart);
  }

  try {
    return JSON.parse(text);
  } catch {
    return { action: 'guess', guess: text.trim() };
  }
}

function parseStructuredInput(
  task: StartTaskMessage,
  requestPart: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const candidates = [
    requestPart?.data,
    requestPart?.value,
    requestPart?.json,
    requestPart?.input,
    requestPart?.request,
    task.requestSummary,
    requestPart,
  ];

  for (const candidate of candidates) {
    const parsed = normalizeCandidate(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return { action: 'start' };
}

function normalizeCandidate(candidate: unknown): Record<string, unknown> | null {
  if (typeof candidate === 'string') {
    if (!candidate.trim()) {
      return null;
    }

    try {
      return JSON.parse(candidate);
    } catch {
      return { action: 'guess', guess: candidate.trim() };
    }
  }

  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return null;
  }

  const object = candidate as Record<string, unknown>;
  const input: Record<string, unknown> = {};

  for (const key of ['action', 'guess', 'state', 'options']) {
    if (key in object) {
      input[key] = object[key];
    }
  }

  return Object.keys(input).length > 0 ? input : null;
}
