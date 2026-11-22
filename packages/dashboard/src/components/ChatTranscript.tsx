import type { ChatItem } from '../types';

export interface ChatTranscriptProps {
  items: ChatItem[];
  /** Only a platform admin may approve a write; everyone may refuse one. */
  canApprove: boolean;
  onApprove?: (id: string) => void;
  onDeny?: (id: string) => void;
}

const json = (value: unknown) => JSON.stringify(value, null, 2);

const STATE: Record<Exclude<Extract<ChatItem, { kind: 'approval' }>['state'], 'pending'>, string> = {
  approving: 'Running…',
  approved: 'Approved and done',
  denied: 'Refused: nothing was changed',
  failed: 'Approved, but it failed',
};

/**
 * The conversation: questions, streamed answers, the tools an answer used, and any change the
 * assistant asked to make, which waits for a person's decision.
 */
export function ChatTranscript({ items, canApprove, onApprove, onDeny }: ChatTranscriptProps) {
  return (
    <ol className="aiqa-chat" aria-label="Conversation">
      {items.map((item) => {
        switch (item.kind) {
          case 'user':
            return (
              <li key={item.id} className="aiqa-chat__msg aiqa-chat__msg--user">
                <span className="aiqa-visually-hidden">You: </span>
                {item.text}
              </li>
            );
          case 'assistant':
            return (
              <li
                key={item.id}
                className="aiqa-chat__msg aiqa-chat__msg--assistant"
                aria-busy={item.streaming ? 'true' : undefined}
              >
                <span className="aiqa-visually-hidden">Assistant: </span>
                <span className="aiqa-chat__text">{item.text}</span>
                {item.streaming ? <span className="aiqa-chat__cursor" aria-hidden="true" /> : null}
                {item.stopped ? <span className="aiqa-chat__note">Stopped</span> : null}
              </li>
            );
          case 'tool':
            return (
              <li key={item.id} className="aiqa-chat__tool">
                <details>
                  <summary>
                    Looked up <code>{item.name}</code>
                  </summary>
                  <pre>{json(item.input)}</pre>
                </details>
              </li>
            );
          case 'approval':
            return (
              <li
                key={item.id}
                className="aiqa-chat__approval"
                aria-label={`Change waiting for approval: ${item.tool}`}
              >
                <p className="aiqa-chat__approval-title">
                  The assistant wants to run <code>{item.tool}</code>
                </p>
                <pre>{json(item.input)}</pre>
                {item.state === 'pending' ? (
                  <div className="aiqa-chat__actions">
                    <button type="button" onClick={() => onApprove?.(item.id)} disabled={!canApprove}>
                      Approve
                    </button>
                    <button type="button" className="aiqa-button--quiet" onClick={() => onDeny?.(item.id)}>
                      Refuse
                    </button>
                    {canApprove ? null : (
                      <span className="aiqa-chat__note">Only a platform admin can approve a change.</span>
                    )}
                  </div>
                ) : (
                  <p className="aiqa-chat__outcome" role="status">
                    {STATE[item.state]}
                    {item.result ? `: ${item.result}` : ''}
                  </p>
                )}
              </li>
            );
          case 'error':
            return (
              <li key={item.id}>
                {/* The alert role goes inside: on the li it would replace the list item role. */}
                <div className="aiqa-chat__error" role="alert">
                  {item.text}
                </div>
              </li>
            );
        }
      })}
    </ol>
  );
}
