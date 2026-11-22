import { useState } from 'react';
import type { ChatItem } from '../types';
import { ChatComposer } from './ChatComposer';
import { ChatTranscript } from './ChatTranscript';

const ASKED: ChatItem[] = [
  { kind: 'user', id: 'u1', text: 'Why did the last ui run fail?' },
  { kind: 'tool', id: 't1', name: 'run_failures', input: { suite: 'ui' } },
];
const ANSWER =
  'One test failed in run ui-08: "checkout › completes an order with two items". The page still showed "Checkout: Overview" when the order confirmation was expected.';

export const Answered = () => (
  <ChatTranscript canApprove={false} items={[...ASKED, { kind: 'assistant', id: 'a1', text: ANSWER }]} />
);

export const Streaming = () => (
  <ChatTranscript
    canApprove={false}
    items={[...ASKED, { kind: 'assistant', id: 'a1', text: ANSWER.slice(0, 40), streaming: true }]}
  />
);

export const Stopped = () => (
  <ChatTranscript
    canApprove={false}
    items={[...ASKED, { kind: 'assistant', id: 'a1', text: ANSWER.slice(0, 40), stopped: true }]}
  />
);

const WRITE = { testId: 'checkout-two', reason: 'Fails every night' };

export const WaitingForAViewer = () => (
  <ChatTranscript
    canApprove={false}
    items={[{ kind: 'approval', id: 'p1', tool: 'quarantine_test', input: WRITE, state: 'pending' }]}
  />
);

export const Outcomes = () => (
  <ChatTranscript
    canApprove
    items={[
      {
        kind: 'approval',
        id: 'p1',
        tool: 'quarantine_test',
        input: WRITE,
        state: 'approved',
        result: 'checkout-two is quarantined',
      },
      { kind: 'approval', id: 'p2', tool: 'quarantine_test', input: WRITE, state: 'denied' },
      {
        kind: 'approval',
        id: 'p3',
        tool: 'quarantine_test',
        input: WRITE,
        state: 'failed',
        result: 'the file is read-only',
      },
      { kind: 'error', id: 'e1', text: 'The model did not answer in time.' },
    ]}
  />
);

/** An admin deciding: the story keeps the state and records each decision for the test to read. */
export const AdminDecides = () => {
  const [items, setItems] = useState<ChatItem[]>([
    { kind: 'approval', id: 'p1', tool: 'quarantine_test', input: WRITE, state: 'pending' },
    {
      kind: 'approval',
      id: 'p2',
      tool: 'quarantine_test',
      input: { testId: 'cart-badge', reason: 'x' },
      state: 'pending',
    },
  ]);
  const [decisions, setDecisions] = useState<string[]>([]);
  const decide = (id: string, state: 'approved' | 'denied') => {
    setItems((all) => all.map((i) => (i.id === id && i.kind === 'approval' ? { ...i, state } : i)));
    setDecisions((d) => [...d, `${id}:${state}`]);
  };
  return (
    <>
      <ChatTranscript
        items={items}
        canApprove
        onApprove={(id) => decide(id, 'approved')}
        onDeny={(id) => decide(id, 'denied')}
      />
      <form hidden>
        <input data-testid="decisions" readOnly value={decisions.join(',')} />
      </form>
    </>
  );
};

/** The composer on its own: what was sent, and whether Stop was pressed. */
export const Composer = ({ busy = false }: { busy?: boolean }) => {
  const [sent, setSent] = useState<string[]>([]);
  const [stops, setStops] = useState(0);
  return (
    <>
      <ChatComposer
        busy={busy}
        onSend={(t) => setSent((s) => [...s, t])}
        onStop={() => setStops((n) => n + 1)}
      />
      <form hidden>
        <input data-testid="sent" readOnly value={JSON.stringify(sent)} />
        <input data-testid="stops" readOnly value={String(stops)} />
      </form>
    </>
  );
};

export const AnsweredDark = () => (
  <div data-theme="dark" className="aiqa-theme-root">
    <ChatTranscript
      canApprove
      items={[
        ...ASKED,
        { kind: 'assistant', id: 'a1', text: ANSWER },
        { kind: 'approval', id: 'p1', tool: 'quarantine_test', input: WRITE, state: 'pending' },
      ]}
    />
    <ChatComposer busy={false} onSend={() => {}} onStop={() => {}} />
  </div>
);
