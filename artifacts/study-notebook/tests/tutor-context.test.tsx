import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/pages/home';
import type { Message } from '@workspace/api-client-react';

let client: QueryClient;
beforeEach(() => {
  sessionStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  client?.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

it('starts a fresh context on every source switch and never labels old replies with a new source', async () => {
  const originalContext = 'old-context-aaaaaaaa';
  sessionStorage.setItem('margin-tutor-session', JSON.stringify({ contextId: originalContext, sourceId: 2 }));
  const stored: Message[] = [{
    id: 1, contextId: originalContext, sourceId: 2, role: 'assistant',
    content: 'Old Boolean explanation from Lecture 02',
    citations: [{ sourceId: 2, sourceTitle: 'Lecture 02: Boolean logic', page: 1, excerpt: 'Old Boolean source excerpt.' }],
    createdAt: new Date().toISOString(),
  }];
  const posted: { sourceId: number; contextId: string; content: string }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    if (url.pathname === '/api/notebook') return Response.json({
      sources: [
        { id: 2, title: 'Boolean logic', lecture: 'Lecture 02', pageCount: 6, description: '' },
        { id: 10, title: 'Traffic light', lecture: 'Lecture 10', pageCount: 3, description: '' },
      ], pendingCount: 0, approvedCount: 0, aiReady: true,
    });
    if (url.pathname === '/api/items') return Response.json([]);
    if (url.pathname === '/api/messages' && init?.method === 'POST') {
      const payload = JSON.parse(String(init.body));
      posted.push(payload);
      const message: Message = {
        id: 2, contextId: payload.contextId, sourceId: payload.sourceId, role: 'assistant',
        content: 'Start with the all-red state. Which lights are red?',
        citations: [{ sourceId: 10, sourceTitle: 'Lecture 10: Traffic light', page: 1, excerpt: 'start with N/S red, E/W red' }],
        createdAt: new Date().toISOString(),
      };
      stored.push(message);
      return Response.json({message, extractedCount: 0});
    }
    if (url.pathname === '/api/messages') return Response.json(stored);
    throw new Error(`Unexpected request ${url.pathname}`);
  }));
  client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  const user = userEvent.setup();
  render(<QueryClientProvider client={client}><Home /></QueryClientProvider>);
  expect(await screen.findByText('Old Boolean explanation from Lecture 02')).toBeVisible();
  await user.type(screen.getByTestId('input-message'), 'unsent previous lecture draft');
  await user.selectOptions(screen.getByTestId('select-source'), '10');
  expect(screen.queryByText('Old Boolean explanation from Lecture 02')).not.toBeInTheDocument();
  expect(screen.queryByTestId('button-citation-2-1-0')).not.toBeInTheDocument();
  expect(screen.getByTestId('input-message')).toHaveValue('');
  expect(screen.getByText('Fresh context for Traffic light.')).toBeVisible();
  expect(posted).toHaveLength(0);
  await user.type(screen.getByTestId('input-message'), "I don't understand.");
  await user.click(screen.getByTestId('button-send'));
  expect(await screen.findByText('Start with the all-red state. Which lights are red?')).toBeVisible();
  expect(posted).toHaveLength(1);
  expect(posted[0].sourceId).toBe(10);
  expect(posted[0].contextId).not.toBe(originalContext);
  expect(screen.getByTestId('button-citation-10-1-0')).toHaveTextContent('Lecture 10: Traffic light');
  await waitFor(() => expect(screen.getByTestId('select-source')).toBeEnabled());
  await user.selectOptions(screen.getByTestId('select-source'), '2');
  expect(screen.queryByText('Old Boolean explanation from Lecture 02')).not.toBeInTheDocument();
  expect(screen.queryByText('Start with the all-red state. Which lights are red?')).not.toBeInTheDocument();
  const returned = JSON.parse(sessionStorage.getItem('margin-tutor-session')!);
  expect(returned.contextId).not.toBe(originalContext);
  expect(returned.contextId).not.toBe(posted[0].contextId);
  expect(returned.sourceId).toBe(2);
});
