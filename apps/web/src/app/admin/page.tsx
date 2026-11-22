import type { Metadata } from 'next';
import { chooseModel } from '@aiqa/ai-agents';
import { formatTime } from '@aiqa/dashboard';
import { loadEnv } from '@aiqa/shared';
import { Frame, PageHead } from '../_components/Frame';
import { listQuarantine } from '@/lib/quarantine';
import { readSettings } from '@/lib/settings';
import { releaseTest, saveSettings } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin' };

const SAVED: Record<string, string> = {
  settings: 'Settings saved. The next chat answer uses them.',
  released: 'The test is back in the gate.',
  invalid: 'Not saved: steps must be 2 to 8 and the time limit 30 to 1800 seconds.',
};

export default async function Admin({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const saved = (await searchParams).saved;
  const env = loadEnv();
  let model: string;
  try {
    model = chooseModel(env).label;
  } catch (error) {
    model = `misconfigured: ${(error as Error).message}`;
  }
  const settings = readSettings();
  const quarantined = listQuarantine();
  return (
    <Frame current="/admin" admin>
      <PageHead
        title="Admin"
        lede="The model the agents and the chat use, the chat's budget, and the tests taken out of the gate."
      />
      {saved && SAVED[saved] ? (
        <p role="status" className="aiqa-card">
          {SAVED[saved]}
        </p>
      ) : null}

      <section className="aiqa-card" aria-labelledby="model-heading">
        <h2 id="model-heading">Model</h2>
        <dl className="aiqa-facts">
          <dt>In use</dt>
          <dd className="aiqa-mono">{model}</dd>
          <dt>Provider setting</dt>
          <dd className="aiqa-mono">AGENT_PROVIDER={env.AGENT_PROVIDER}</dd>
          <dt>Model name</dt>
          <dd className="aiqa-mono">{env.AGENT_MODEL ?? env.OLLAMA_MODEL}</dd>
          <dt>Endpoint</dt>
          <dd className="aiqa-mono">{env.AGENT_BASE_URL ?? env.OLLAMA_URL}</dd>
          <dt>API key</dt>
          <dd>{env.AGENT_API_KEY ? 'set (not shown)' : 'not set'}</dd>
        </dl>
        <p className="aiqa-page-lede">
          The model comes from <code>.env</code> (ADR 0014), so a key never passes through this page. Change
          it there and restart.
        </p>
      </section>

      <section className="aiqa-card" aria-labelledby="budget-heading">
        <h2 id="budget-heading">Chat budget</h2>
        <form action={saveSettings} className="aiqa-form">
          <label>
            Model steps per answer (2 to 8)
            <input
              name="chatMaxSteps"
              type="number"
              min={2}
              max={8}
              required
              defaultValue={settings.chatMaxSteps}
            />
          </label>
          <label>
            Time limit per answer, seconds (30 to 1800)
            <input
              name="chatTimeoutSec"
              type="number"
              min={30}
              max={1800}
              required
              defaultValue={settings.chatTimeoutSec}
            />
          </label>
          <label className="aiqa-check">
            <input name="chatWritesEnabled" type="checkbox" defaultChecked={settings.chatWritesEnabled} />
            The chat may ask to quarantine a test (an admin still approves each one)
          </label>
          <button type="submit">Save settings</button>
        </form>
      </section>

      <section aria-labelledby="quarantine-heading">
        <h2 id="quarantine-heading">Quarantined tests</h2>
        {quarantined.length ? (
          <div className="aiqa-table-wrap">
            <table className="aiqa-table">
              <caption>Tests out of the gate, approved through the chat</caption>
              <thead>
                <tr>
                  <th scope="col">Test</th>
                  <th scope="col">Reason</th>
                  <th scope="col">Asked by</th>
                  <th scope="col">Approved by</th>
                  <th scope="col">When</th>
                  <th scope="col">
                    <span className="aiqa-visually-hidden">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {quarantined.map((q) => (
                  <tr key={q.testId}>
                    <th scope="row" className="aiqa-mono">
                      {q.testId}
                    </th>
                    <td>{q.reason}</td>
                    <td>{q.requestedBy}</td>
                    <td>{q.approvedBy}</td>
                    <td>{formatTime(q.at)}</td>
                    <td>
                      <form action={releaseTest}>
                        <input type="hidden" name="testId" value={q.testId} />
                        <button
                          type="submit"
                          className="aiqa-button--quiet"
                          aria-label={`Release ${q.testId}`}
                        >
                          Release
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="aiqa-empty">No test is quarantined.</p>
        )}
      </section>

      <p>
        Every agent and chat run is in the <a href="/agents">agent run log</a>.
      </p>
    </Frame>
  );
}
