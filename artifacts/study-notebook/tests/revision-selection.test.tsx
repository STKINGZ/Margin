import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RevisionPractice } from '@/components/testing/revision-practice';
import type { RevisionGroup } from '@/lib/testing';
import { blank, incorrect, source } from './revision-fixtures';

function mountSelection(groups: RevisionGroup[]) {
  const onBack = vi.fn();
  const onExit = vi.fn();
  render(<RevisionPractice groups={groups} sources={[source]} onBack={onBack} onExit={onExit} />);
  return { user: userEvent.setup(), onBack, onExit };
}

const groups: RevisionGroup[] = [
  { sourceId: source.id, category: incorrect.category, incorrect: 1, blank: 0, repeated: 1, questions: [incorrect] },
  // Same category, different lecture must be independently selectable.
  { sourceId: 99, category: incorrect.category, incorrect: 0, blank: 1, repeated: 0, questions: [{ ...blank, sourceId: 99, category: incorrect.category }] },
  { sourceId: source.id, category: 'Unavailable', incorrect: 0, blank: 1, repeated: 0, questions: [] },
];

describe('Revision topic selection', () => {
  it('counts available topics, clears and selects all, and keeps unsupported topics disabled', async () => {
    const { user, onBack, onExit } = mountSelection(groups);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).toBeChecked();
    expect(boxes[2]).toBeDisabled();
    expect(boxes[2]).not.toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2 available topics selected · 2 practice questions');
    expect(screen.getByText(/retrying 1 missed question/)).toBeVisible();
    expect(screen.queryByTestId('text-question')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByTestId('button-start-revision')).toBeDisabled();
    expect(screen.getByText('Select at least one topic to start revision.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Select all topics' }));
    expect(screen.getByRole('status')).toHaveTextContent('2 of 2 available topics selected · 2 practice questions');
    expect(boxes[2]).not.toBeChecked();
    await user.click(boxes[0]);
    expect(boxes[1]).toBeChecked();
    expect(screen.getByRole('status')).toHaveTextContent('1 of 2 available topics selected · 1 practice questions');
    await user.click(screen.getByTestId('button-start-revision'));
    expect(screen.getByTestId('text-question').textContent).toBe(blank.prompt);
    expect(screen.getByTestId('text-practice-score')).toHaveTextContent('bank of 1');
    const topics = screen.getByRole('list', { name: 'Revision topics' });
    expect(within(topics).getAllByRole('listitem')).toHaveLength(1);
    expect(topics).toHaveTextContent('Lecture 99');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByTestId('text-explanation')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to exam results' }));
    expect(onBack).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Exit targeted revision' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('resets the temporary attempt when choosing different topics', async () => {
    const { user } = mountSelection(groups);
    await user.click(screen.getAllByRole('checkbox')[1]);
    await user.click(screen.getByTestId('button-start-revision'));
    await user.click(screen.getByTestId('button-choice-0'));
    await user.click(screen.getByTestId('button-check'));
    expect(screen.getByTestId('text-explanation')).toBeVisible();
    await user.type(screen.getByTestId('input-scratchpad'), 'old work');
    await user.click(screen.getByRole('button', { name: 'Choose different topics (resets practice)' }));
    expect(screen.queryByTestId('text-question')).not.toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes[0]).toBeChecked();
    expect(boxes[1]).not.toBeChecked();
    await user.click(boxes[0]);
    await user.click(boxes[1]);
    await user.click(screen.getByTestId('button-start-revision'));
    expect(screen.getByTestId('text-question').textContent).toBe(blank.prompt);
    expect(screen.getByTestId('text-practice-score')).toHaveTextContent('Session: 0 of 0 correct');
    expect(screen.getByTestId('input-scratchpad')).toHaveValue('');
    expect(screen.queryByTestId('text-explanation')).not.toBeInTheDocument();
    expect(screen.getByTestId('button-check')).toBeDisabled();
  });

  it.each([{ unavailable: [] }, { unavailable: [groups[2]] }])('cannot start when no topic has grounded questions: $unavailable', ({ unavailable }) => {
    mountSelection(unavailable);
    expect(screen.getByTestId('button-start-revision')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Select all topics' })).toBeDisabled();
    expect(screen.getByText('No source-supported practice available for these missed topics.')).toBeVisible();
    expect(screen.queryByTestId('text-question')).not.toBeInTheDocument();
  });
});
