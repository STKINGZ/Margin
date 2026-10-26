import { afterEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getGetSourceQueryKey, type ExamAttempt } from '@workspace/api-client-react';
import Library from '@/pages/library';
import { bank, blank, completedExam, correct, incorrect, source } from './revision-fixtures';

const clients: QueryClient[] = [];
afterEach(() => {
  clients.splice(0).forEach(client => client.clear());
  vi.unstubAllGlobals();
});

function mountHub(attempt: ExamAttempt) {
  const requests: { path: string; method: string }[] = [];
  const unexpected: string[] = [];
  // Fetch is the only mocked boundary. Generated API hooks, saved-exam state,
  // question generation, all four UI components, and citation dialogs are real.
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, 'http://localhost');
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    requests.push({ path: url.pathname, method });
    let data: unknown;
    if (method === 'GET' && url.pathname === '/api/notebook') {
      data = { sources: [source], pendingCount: 0, approvedCount: 0, privacyNotice: '', aiReady: false };
    } else if (method === 'GET' && url.pathname === '/api/items' && url.searchParams.get('status') === 'approved') {
      data = [];
    } else if (method === 'GET' && url.pathname === '/api/exams') {
      const { questions: _questions, answers: _answers, ...summary } = attempt;
      data = [summary];
    } else if (method === 'GET' && url.pathname === `/api/exams/${attempt.id}`) {
      data = attempt;
    } else if (method === 'GET' && url.pathname === `/api/sources/${source.id}`) {
      data = source;
    } else {
      unexpected.push(`${method} ${url.pathname}${url.search}`);
      return Response.json({ error: 'Unexpected test request' }, { status: 500 });
    }
    return Response.json(data);
  }));
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  clients.push(client);
  render(<QueryClientProvider client={client}><Library /></QueryClientProvider>);
  return { user: userEvent.setup(), requests, unexpected, client };
}

async function openResults(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Exam Simulator' }));
  await user.click(await screen.findByRole('button', { name: 'View results' }));
  return screen.findByRole('region', { name: 'Exam results' });
}

function expectUnrevealed(region: HTMLElement) {
  const ui = within(region);
  expect(ui.queryByTestId('text-explanation')).not.toBeInTheDocument();
  expect(ui.queryByRole('list', { name: 'Citations' })).not.toBeInTheDocument();
  expect(ui.queryByTestId('text-citation-excerpt')).not.toBeInTheDocument();
  expect(region.querySelector('[data-testid^="button-citation-"]')).toBeNull();
  // Choices themselves are visible; their correctness must not be marked.
  expect(region.querySelector('svg.lucide-check, svg.lucide-x')).toBeNull();
}

function expectReadOnly(requests: { path: string; method: string }[], unexpected: string[]) {
  expect(unexpected).toEqual([]);
  expect(requests.some(r => r.path === '/api/items' && r.method === 'POST')).toBe(false);
  expect(requests.filter(r => r.method !== 'GET')).toEqual([]);
}

describe('Testing Hub targeted revision wiring', () => {
  it('revises incorrect and blank topics, gates every reveal, finishes, and preserves the original result', async () => {
    const attempt = completedExam();
    const original = JSON.stringify(attempt);
    const { user, requests, unexpected } = mountHub(attempt);
    const results = await openResults(user);
    const score = within(results).getByTestId('text-score').textContent;
    expect(score).toMatch(/1 \/ 3.*33\.3%/);
    expect(within(results).getByText(/1 left blank, counted wrong/)).toBeVisible();
    const revise = within(results).getByRole('button', { name: 'Revise missed topics (2)' });
    await waitFor(() => expect(revise).toBeEnabled());
    await user.click(revise);

    const revision = screen.getByRole('region', { name: 'Targeted revision' });
    const ui = within(revision);
    expect(results).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Applied Practice' })).toHaveAttribute('aria-current', 'page');
    const topics = ui.getByRole('list', { name: 'Revision topics' });
    const rows = within(topics).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.textContent?.includes(incorrect.category))).toHaveTextContent('1 incorrect · 0 blank');
    expect(rows.find(row => row.textContent?.includes(blank.category))).toHaveTextContent('0 incorrect · 1 blank');
    expect(topics).not.toHaveTextContent(correct.category);
    expect(topics).toHaveTextContent(source.title);
    expect(ui.queryByTestId('text-question')).not.toBeInTheDocument();
    await user.click(ui.getByTestId('button-start-revision'));

    // Drive the finite session through actual controls, not component callbacks.
    const total = Number(ui.getByTestId('text-practice-score').textContent?.match(/bank of (\d+)/)?.[1]);
    expect(total).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < total; index++) {
      expectUnrevealed(revision);
      expect(ui.getByTestId('text-practice-score')).toHaveTextContent(`of ${index} correct`);
      const check = ui.getByRole('button', { name: 'Check answer' });
      expect(check).toBeDisabled();
      const prompt = ui.getByTestId('text-question').textContent;
      const question = bank.find(q => q.prompt === prompt)!;
      expect(question).toBeDefined();
      // One wrong revision answer proves its score is separate from the exam's.
      const answer = index === 0
        ? question.choices.find(choice => choice !== question.choices[question.correctIndex])!
        : question.choices[question.correctIndex];
      const choice = ui.getAllByRole('button').find(button =>
        button.dataset.testid?.startsWith('button-choice-') && button.textContent?.endsWith(answer))!;
      await user.click(choice);
      expect(choice).toHaveAttribute('aria-pressed', 'true');
      expect(check).toBeEnabled();
      expectUnrevealed(revision);
      await user.click(check);
      expect(ui.getByTestId('text-explanation')).toHaveTextContent(question.explanation);
      expect(ui.getByTestId('text-explanation')).toHaveTextContent(index === 0 ? 'Incorrect' : 'Correct');
      expect(ui.queryByRole('button', { name: 'Check answer' })).not.toBeInTheDocument();
      ui.getAllByTestId(/^button-choice-/).forEach(button => expect(button).toBeDisabled());
      expect(revision.querySelector('svg.lucide-check')).not.toBeNull();
      await user.click(ui.getByTestId(/^button-citation-/));
      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByTestId('text-citation-excerpt').textContent).toBe(question.citations[0].excerpt);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      await user.type(ui.getByTestId('input-scratchpad'), 'temporary working');
      await user.click(ui.getByRole('button', { name: index === total - 1 ? 'Finish revision' : 'Next problem' }));
      if (index < total - 1) expect(ui.getByTestId('input-scratchpad')).toHaveValue('');
    }

    expect(ui.getByTestId('revision-complete')).toHaveTextContent(`You answered ${total - 1} of ${total} correctly`);
    expect(ui.queryByTestId('button-check')).not.toBeInTheDocument();
    expect(ui.queryByTestId('button-next')).not.toBeInTheDocument();
    await user.click(ui.getByRole('button', { name: 'Back to exam results' }));
    expect(screen.getByRole('region', { name: 'Exam results' })).toBeVisible();
    expect(within(results).getByTestId('text-score').textContent).toBe(score);
    expect(screen.getByRole('button', { name: 'Exam Simulator' })).toHaveAttribute('aria-current', 'page');
    expect(JSON.stringify(attempt)).toBe(original);
    expectReadOnly(requests, unexpected);

    // Re-entering starts a new revision rather than retaining a completed run.
    await user.click(revise);
    const restarted = screen.getByRole('region', { name: 'Targeted revision' });
    expect(within(restarted).queryByTestId('revision-complete')).not.toBeInTheDocument();
    expect(within(restarted).queryByTestId('text-question')).not.toBeInTheDocument();
    await user.click(within(restarted).getByTestId('button-start-revision'));
    expect(within(restarted).getByTestId('text-practice-score')).toHaveTextContent('Session: 0 of 0 correct');
    expectUnrevealed(restarted);
    expectReadOnly(requests, unexpected);
  });

  it('revises only the selected missed topic without changing any original results', async () => {
    const attempt = completedExam();
    const original = JSON.stringify(attempt);
    const { user, requests, unexpected } = mountHub(attempt);
    const results = await openResults(user);
    const resultText = results.textContent;
    const revise = within(results).getByTestId('button-revise-missed');
    await waitFor(() => expect(revise).toBeEnabled());
    await user.click(revise);
    const revision = screen.getByRole('region', { name: 'Targeted revision' });
    const ui = within(revision);
    await user.click(ui.getByRole('checkbox', { name: new RegExp(blank.category) }));
    const row = within(ui.getByRole('list', { name: 'Revision topics' })).getAllByRole('listitem')
      .find(item => item.textContent?.includes(incorrect.category))!;
    const total = Number(row.textContent?.match(/(\d+) practice questions/)?.[1]);
    expect(ui.getByRole('status')).toHaveTextContent(`1 of 2 available topics selected · ${total} practice questions`);
    await user.click(ui.getByTestId('button-start-revision'));
    for (let index = 0; index < total; index++) {
      const question = bank.find(q => q.prompt === ui.getByTestId('text-question').textContent)!;
      expect(question.category).toBe(incorrect.category);
      expectUnrevealed(revision);
      await user.click(ui.getByTestId('button-choice-0'));
      await user.click(ui.getByTestId('button-check'));
      await user.click(ui.getByTestId('button-next'));
    }
    expect(ui.getByTestId('revision-complete')).toBeVisible();
    await user.click(ui.getByRole('button', { name: 'Back to exam results' }));
    expect(results.textContent).toBe(resultText);
    expect(within(results).getAllByTestId(/^result-/)).toHaveLength(3);
    expect(JSON.stringify(attempt)).toBe(original);
    expectReadOnly(requests, unexpected);
  });

  it('disables revision for a perfect score even once lecture evidence has loaded', async () => {
    const { user, requests, unexpected, client } = mountHub(completedExam(true));
    const results = await openResults(user);
    await waitFor(() => expect(client.getQueryData(getGetSourceQueryKey(source.id))).toEqual(source));
    // Retry becomes enabled after the saved-exam open operation has settled.
    await waitFor(() => expect(within(results).getByRole('button', { name: 'Retry same exam' })).toBeEnabled());
    expect(within(results).getByTestId('text-score')).toHaveTextContent('3 / 3 100.0%');
    const revise = within(results).getByRole('button', { name: 'Revise missed topics (0)' });
    expect(revise).toBeDisabled();
    expect(within(results).getByText('All correct — no missed topics to revise.')).toBeVisible();
    await user.click(revise);
    expect(screen.queryByRole('region', { name: 'Targeted revision' })).not.toBeInTheDocument();
    expectReadOnly(requests, unexpected);
  });

  it('keeps regular Applied Practice answers hidden until checked and resets the next question', async () => {
    const { user, requests, unexpected } = mountHub(completedExam());
    await user.click(screen.getByRole('button', { name: 'Applied Practice' }));
    const practice = screen.getByRole('region', { name: 'Applied Practice' });
    const ui = within(practice);
    await user.selectOptions(await ui.findByRole('combobox', { name: 'Lecture' }), String(source.id));
    await ui.findByTestId('text-question');
    expectUnrevealed(practice);
    expect(ui.getByRole('button', { name: 'Check answer' })).toBeDisabled();
    await user.click(ui.getByTestId('button-choice-0'));
    expectUnrevealed(practice);
    await user.click(ui.getByRole('button', { name: 'Check answer' }));
    expect(ui.getByTestId('text-explanation')).toBeVisible();
    expect(ui.getByRole('list', { name: 'Citations' })).toBeVisible();
    await user.click(ui.getByRole('button', { name: 'Next problem' }));
    expectUnrevealed(practice);
    expect(ui.getByRole('button', { name: 'Check answer' })).toBeDisabled();
    expectReadOnly(requests, unexpected);
  });
});
