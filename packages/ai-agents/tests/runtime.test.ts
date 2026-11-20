import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { chooseModel, defineTool, JsonlRunLog, runAgent, runRecord } from '../src';
import { scriptedModel } from './mock';

const answer = z.object({ result: z.string() });

const readTool = (seen: unknown[]) =>
  defineTool({
    name: 'lookup',
    description: 'reads something',
    input: z.object({ key: z.string() }),
    kind: 'read',
    run: async (input) => {
      seen.push(input);
      return { value: `value of ${input.key}` };
    },
  });

describe('runAgent', () => {
  it('runs read tools and returns the answer in the output schema', async () => {
    const seen: unknown[] = [];
    const { model } = scriptedModel([
      { call: 'lookup', input: { key: 'a' } },
      { answer: { result: 'done' } },
    ]);
    const run = await runAgent({
      agent: 't',
      model,
      modelLabel: 'mock',
      system: 's',
      prompt: 'p',
      tools: [readTool(seen)],
      output: answer,
    });
    expect(run.output).toEqual({ result: 'done' });
    expect(seen).toEqual([{ key: 'a' }]);
    expect(run.toolCalls).toMatchObject([{ tool: 'lookup', status: 'ok' }]);
    expect(run.tokens).toEqual({ input: 20, output: 10 });
  });

  it('stops running tools at the budget and takes the tools away so the model must answer', async () => {
    const seen: unknown[] = [];
    const script = scriptedModel([
      { call: 'lookup', input: { key: '1' } },
      { call: 'lookup', input: { key: '2' } },
      { call: 'lookup', input: { key: '3' } },
      { answer: { result: 'enough' } },
    ]);
    const run = await runAgent({
      agent: 't',
      model: script.model,
      modelLabel: 'mock',
      system: 's',
      prompt: 'p',
      tools: [readTool(seen)],
      output: answer,
      maxToolCalls: 2,
    });
    // The third call is never run: once the budget is spent the model is offered no tools at all.
    expect(seen).toHaveLength(2);
    expect(run.toolCalls.map((c) => c.status)).toEqual(['ok', 'ok']);
    expect(script.toolsOffered.slice(0, 3)).toEqual([['lookup'], ['lookup'], []]);
    expect(run.output).toEqual({ result: 'enough' });
  });

  it('never runs a write tool without approval, and runs it once approved', async () => {
    const writes: unknown[] = [];
    const writeTool = defineTool({
      name: 'create_branch',
      description: 'creates a git branch',
      input: z.object({ name: z.string() }),
      kind: 'write',
      run: async (input) => {
        writes.push(input);
        return { created: true };
      },
    });
    const script = () =>
      scriptedModel([{ call: 'create_branch', input: { name: 'fix' } }, { answer: { result: 'ok' } }]);

    const denied = await runAgent({
      agent: 't',
      model: script().model,
      modelLabel: 'm',
      system: 's',
      prompt: 'p',
      tools: [writeTool],
      output: answer,
    });
    expect(writes).toEqual([]);
    expect(denied.toolCalls).toMatchObject([{ tool: 'create_branch', status: 'denied' }]);

    const asked: unknown[] = [];
    await runAgent({
      agent: 't',
      model: script().model,
      modelLabel: 'm',
      system: 's',
      prompt: 'p',
      tools: [writeTool],
      output: answer,
      approve: async (call) => {
        asked.push(call);
        return true;
      },
    });
    expect(asked).toEqual([{ agent: 't', tool: 'create_branch', input: { name: 'fix' } }]);
    expect(writes).toEqual([{ name: 'fix' }]);
  });

  it("hands a failing tool's error back to the model as data and carries on", async () => {
    const broken = defineTool({
      name: 'lookup',
      description: 'breaks',
      input: z.object({}),
      kind: 'read',
      run: async () => {
        throw new Error('history file is locked');
      },
    });
    const script = scriptedModel([{ call: 'lookup' }, { answer: { result: 'answered anyway' } }]);
    const run = await runAgent({
      agent: 't',
      model: script.model,
      modelLabel: 'm',
      system: 's',
      prompt: 'p',
      tools: [broken],
      output: answer,
    });
    expect(run.toolCalls).toMatchObject([{ status: 'error', error: 'history file is locked' }]);
    expect(JSON.stringify(script.prompts.at(-1))).toContain('history file is locked');
    expect(run.output.result).toBe('answered anyway');
  });

  it('throws when the model answers outside the schema, so the caller can fall back', async () => {
    const { model } = scriptedModel([{ text: '{"verdict":"maybe"}' }]);
    await expect(
      runAgent({ agent: 't', model, modelLabel: 'm', system: 's', prompt: 'p', tools: [], output: answer }),
    ).rejects.toThrow();
  });
});

describe('chooseModel', () => {
  const base = {
    AI_ENABLED: false,
    OLLAMA_URL: 'http://127.0.0.1:11434',
    OLLAMA_MODEL: 'qwen2.5-coder:7b',
  } as const;

  it('is off unless AI is enabled or a provider is named', () => {
    expect(chooseModel({ ...base, AGENT_PROVIDER: 'auto' })).toEqual({ label: 'off' });
  });

  it('uses Ollama with the agent model when AI is enabled', () => {
    const choice = chooseModel({
      ...base,
      AI_ENABLED: true,
      AGENT_PROVIDER: 'auto',
      AGENT_MODEL: 'qwen3:8b',
    });
    expect(choice.label).toBe('ollama:qwen3:8b');
    expect(choice.model).toBeDefined();
  });

  it('needs a base URL and a model name for a hosted model', () => {
    expect(() => chooseModel({ ...base, AGENT_PROVIDER: 'openai-compatible' })).toThrow(/AGENT_BASE_URL/);
    const hosted = chooseModel({
      ...base,
      AGENT_PROVIDER: 'openai-compatible',
      AGENT_BASE_URL: 'https://api.example.com/v1',
      AGENT_MODEL: 'some-model',
      AGENT_API_KEY: 'not-a-real-key',
    });
    expect(hosted.label).toBe('openai-compatible:some-model');
  });
});

describe('JsonlRunLog', () => {
  it('appends one line per run and reads newest first, skipping a torn line', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-agents-')), 'runs.jsonl');
    const log = new JsonlRunLog(file);
    const record = (agent: string) =>
      runRecord({
        agent,
        durationMs: 1,
        model: 'off',
        source: 'rules',
        input: {},
        output: {},
        toolCalls: [],
      });
    log.write(record('first'));
    log.write(record('second'));
    fs.appendFileSync(file, '{"agent":"tor');
    expect(log.read().map((r) => r.agent)).toEqual(['second', 'first']);
    fs.rmSync(path.dirname(file), { recursive: true, force: true });
  });
});
