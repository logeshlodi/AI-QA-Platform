'use client';
import { useState } from 'react';

export interface ChatComposerProps {
  /** An answer is streaming: Send becomes Stop. */
  busy: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  maxLength?: number;
}

/** Where the question is typed. Enter sends, Shift+Enter adds a line. */
export function ChatComposer({ busy, onSend, onStop, maxLength = 2000 }: ChatComposerProps) {
  const [text, setText] = useState('');
  const send = () => {
    const question = text.trim();
    if (!question || busy) return;
    onSend(question);
    setText('');
  };
  return (
    <form
      className="aiqa-composer"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label htmlFor="aiqa-question" className="aiqa-visually-hidden">
        Ask about runs, failures, flaky tests or heals
      </label>
      <textarea
        id="aiqa-question"
        value={text}
        maxLength={maxLength}
        rows={2}
        placeholder="Ask about runs, failures, flaky tests or heals"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
      />
      {busy ? (
        <button type="button" onClick={onStop}>
          Stop
        </button>
      ) : (
        <button type="submit" disabled={!text.trim()}>
          Send
        </button>
      )}
    </form>
  );
}
