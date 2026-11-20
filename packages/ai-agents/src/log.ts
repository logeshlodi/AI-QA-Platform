import fs from 'node:fs';
import path from 'node:path';

/** Repository root: packages/ai-agents/src -> ../../.. */
export const AGENT_LOG_FILE = path.resolve(__dirname, '..', '..', '..', '.aiqa', 'agents', 'runs.jsonl');

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  /** ok, an error message, "denied" (no approval) or "over budget". */
  status: 'ok' | 'error' | 'denied' | 'over-budget';
  error?: string;
  durationMs: number;
}

/** One agent run, as the admin area and `aiqa agents log` show it. */
export interface AgentRunRecord {
  id: string;
  agent: string;
  startedAt: string;
  durationMs: number;
  model: string;
  /** What the answer came from: the model, or the agent's plain-code rules. */
  source: 'model' | 'rules';
  /** Why the model was not used or did not answer, when it was not or did not. */
  fallbackReason?: string;
  input: unknown;
  output: unknown;
  toolCalls: ToolCallRecord[];
  tokens?: { input: number; output: number };
}

export interface RunLog {
  write(record: AgentRunRecord): void;
  read(limit?: number): AgentRunRecord[];
}

/** One JSON line per run: append-only, readable with any tool, safe to delete. */
export class JsonlRunLog implements RunLog {
  constructor(private readonly file = AGENT_LOG_FILE) {}

  write(record: AgentRunRecord): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.appendFileSync(this.file, JSON.stringify(record) + '\n');
  }

  /** Newest first. Lines that do not parse (a run killed mid-write) are skipped. */
  read(limit = 20): AgentRunRecord[] {
    if (!fs.existsSync(this.file)) return [];
    const records: AgentRunRecord[] = [];
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try {
        records.push(JSON.parse(line) as AgentRunRecord);
      } catch {
        // a torn last line; the next write starts a fresh one
      }
    }
    return records.reverse().slice(0, limit);
  }
}

export class MemoryRunLog implements RunLog {
  readonly records: AgentRunRecord[] = [];
  write(record: AgentRunRecord): void {
    this.records.push(record);
  }
  read(limit = 20): AgentRunRecord[] {
    return [...this.records].reverse().slice(0, limit);
  }
}
