'use client';
import { ChatComposer, ChatTranscript, type ChatItem } from '@aiqa/dashboard';
import { useRef, useState } from 'react';

type Event =
  | { type: 'text'; text: string }
  | { type: 'tool'; name: string; input: unknown }
  | { type: 'approval'; id: string; tool: string; input: unknown; token: string }
  | { type: 'error'; message: string }
  | { type: 'done' };

let counter = 0;
const nextId = () => `c${++counter}`;

/** The conversation in the browser: sends the history, reads the answer line by line as it streams. */
export function ChatPanel({ canApprove }: { canApprove: boolean }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const tokens = useRef(new Map<string, string>());

  const update = (id: string, change: (item: ChatItem) => ChatItem) =>
    setItems((all) => all.map((i) => (i.id === id ? change(i) : i)));

  async function send(question: string) {
    const history = items
      .filter(
        (i): i is Extract<ChatItem, { kind: 'user' | 'assistant' }> =>
          i.kind === 'user' || i.kind === 'assistant',
      )
      .filter((i) => i.text.trim())
      .map((i) => ({ role: i.kind, content: i.text }));
    const answerId = nextId();
    setItems((all) => [...all, { kind: 'user', id: nextId(), text: question }]);
    setBusy(true);
    const controller = new AbortController();
    abort.current = controller;
    let answerShown = false;
    const showAnswer = (text: string) => {
      if (!answerShown) {
        answerShown = true;
        setItems((all) => [...all, { kind: 'assistant', id: answerId, text, streaming: true }]);
      } else update(answerId, (i) => (i.kind === 'assistant' ? { ...i, text: i.text + text } : i));
    };
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'user', content: question }].slice(-20) }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const reason = ((await response.json().catch(() => ({}))) as { error?: string }).error;
        setItems((all) => [
          ...all,
          { kind: 'error', id: nextId(), text: `The chat could not answer: ${reason ?? response.status}` },
        ]);
        return;
      }
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const raw = buffer.slice(0, newline);
          buffer = buffer.slice(newline + 1);
          if (!raw.trim()) continue;
          const event = JSON.parse(raw) as Event;
          if (event.type === 'text') showAnswer(event.text);
          else if (event.type === 'tool')
            setItems((all) => [...all, { kind: 'tool', id: nextId(), name: event.name, input: event.input }]);
          else if (event.type === 'approval') {
            tokens.current.set(event.id, event.token);
            setItems((all) => [
              ...all,
              { kind: 'approval', id: event.id, tool: event.tool, input: event.input, state: 'pending' },
            ]);
          } else if (event.type === 'error')
            setItems((all) => [...all, { kind: 'error', id: nextId(), text: event.message }]);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        if (answerShown) update(answerId, (i) => (i.kind === 'assistant' ? { ...i, stopped: true } : i));
        else setItems((all) => [...all, { kind: 'assistant', id: answerId, text: '', stopped: true }]);
      } else
        setItems((all) => [
          ...all,
          { kind: 'error', id: nextId(), text: `The chat could not answer: ${(error as Error).message}` },
        ]);
    } finally {
      update(answerId, (i) => (i.kind === 'assistant' ? { ...i, streaming: false } : i));
      setBusy(false);
      abort.current = null;
    }
  }

  async function decide(id: string, decision: 'approve' | 'refuse') {
    const token = tokens.current.get(id);
    if (!token) return;
    update(id, (i) => (i.kind === 'approval' ? { ...i, state: 'approving' } : i));
    const response = await fetch('/api/chat/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, decision }),
    });
    const outcome = (await response.json().catch(() => ({}))) as {
      state?: 'approved' | 'denied' | 'failed';
      result?: string;
      error?: string;
    };
    update(id, (i) =>
      i.kind === 'approval'
        ? { ...i, state: outcome.state ?? 'failed', result: outcome.result ?? outcome.error }
        : i,
    );
  }

  return (
    <section className="aiqa-chat-panel" aria-label="Chat">
      {items.length ? null : (
        <p className="aiqa-page-lede">
          Try: “Why did the last ui run fail?”, “Which tests are flaky?” or “What did the healer change?”
        </p>
      )}
      <ChatTranscript
        items={items}
        canApprove={canApprove}
        onApprove={(id) => void decide(id, 'approve')}
        onDeny={(id) => void decide(id, 'refuse')}
      />
      <ChatComposer busy={busy} onSend={(q) => void send(q)} onStop={() => abort.current?.abort()} />
    </section>
  );
}
