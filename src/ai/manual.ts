// "Use my ChatGPT (or Claude) subscription": copy & paste mode. No API key.
// The app prepares the full, story-aware request; the author pastes it into her
// chat app and pastes the answer back. Everything else works as normal.
import type { AIProvider } from './provider';
import { AIError } from './errors';

export interface ManualRequest {
  prompt: string;
  resolve: (text: string) => void;
  reject: (e: Error) => void;
}

let listener: ((r: ManualRequest | null) => void) | null = null;
const queue: ManualRequest[] = [];

export function onManualRequest(l: ((r: ManualRequest | null) => void) | null) {
  listener = l;
  if (l && queue.length) l(queue[0]);
}

export function finishManual(r: ManualRequest) {
  queue.splice(queue.indexOf(r), 1);
  listener?.(queue[0] ?? null);
}

export const manualProvider: AIProvider = {
  id: 'manual',
  name: 'My ChatGPT or Claude subscription (copy & paste)',
  models: [],
  complete(req) {
    const convo = req.messages
      .map((m, i) => (req.messages.length === 1 ? m.content : `${m.role === 'user' ? (i === 0 ? 'REQUEST' : 'FOLLOW-UP') : 'YOUR EARLIER ANSWER'}:\n${m.content}`))
      .join('\n\n---\n\n');
    const prompt = `${req.system}\n\n${req.context ? `${req.context}\n\n` : ''}=====\n\n${convo}`;
    return new Promise((resolve, reject) => {
      const r: ManualRequest = {
        prompt,
        resolve: (text) => resolve({ text, usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 }, stoppedEarly: false }),
        reject,
      };
      req.signal?.addEventListener('abort', () => {
        reject(new AIError('Stopped.', 'cancelled'));
        finishManual(r);
      });
      queue.push(r);
      if (queue.length === 1) listener?.(r);
    });
  },
};
