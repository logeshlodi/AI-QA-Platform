import { describe, expect, it, vi } from 'vitest';
import {
  completeJson,
  createProvider,
  draftBugReport,
  FakeProvider,
  OllamaProvider,
  pickElement,
} from '../src';
import { z } from 'zod';

const json = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;

describe('OllamaProvider', () => {
  it('is available only when the configured model is pulled', async () => {
    const fetchImpl = vi.fn(async () => json({ models: [{ name: 'qwen2.5-coder:7b' }] }));
    const have = new OllamaProvider({ baseUrl: 'http://o', model: 'qwen2.5-coder:7b', fetchImpl });
    const missing = new OllamaProvider({ baseUrl: 'http://o', model: 'llama3', fetchImpl });
    expect(await have.isAvailable()).toBe(true);
    expect(await missing.isAvailable()).toBe(false);
  });

  it('reports unavailable instead of throwing when the server is down', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    expect(await new OllamaProvider({ baseUrl: 'http://o', model: 'm', fetchImpl }).isAvailable()).toBe(
      false,
    );
  });

  it('sends a non-streaming, temperature-0 request and returns the text', async () => {
    const fetchImpl = vi.fn(async () => json({ response: 'hello' }));
    const provider = new OllamaProvider({ baseUrl: 'http://o', model: 'm', fetchImpl });
    expect(await provider.complete({ system: 's', prompt: 'p', json: true })).toBe('hello');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://o/api/generate');
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: 'm',
      stream: false,
      format: 'json',
      options: { temperature: 0 },
    });
  });

  it('throws on a non-2xx answer', async () => {
    const fetchImpl = vi.fn(async () => json({}, false, 404));
    await expect(
      new OllamaProvider({ baseUrl: 'http://o', model: 'm', fetchImpl }).complete({ system: '', prompt: '' }),
    ).rejects.toThrow(/404/);
  });
});

describe('createProvider', () => {
  it('returns a disabled provider unless AI is switched on', async () => {
    const off = createProvider({ AI_ENABLED: false, OLLAMA_URL: 'http://o', OLLAMA_MODEL: 'm' });
    expect(off.name).toBe('none');
    expect(await off.isAvailable()).toBe(false);
    expect(createProvider({ AI_ENABLED: true, OLLAMA_URL: 'http://o', OLLAMA_MODEL: 'm' }).name).toBe(
      'ollama:m',
    );
  });
});

describe('completeJson', () => {
  const schema = z.object({ index: z.number().int() });
  it('extracts JSON even when the model wraps it in prose', async () => {
    expect(
      await completeJson(
        new FakeProvider(['Sure! {"index": 2} Hope that helps']),
        { system: '', prompt: '' },
        schema,
      ),
    ).toEqual({ index: 2 });
  });
  it.each(['not json', '{"index":"two"}', '{broken', ''])('returns undefined for %j', async (raw) => {
    expect(await completeJson(new FakeProvider([raw]), { system: '', prompt: '' }, schema)).toBeUndefined();
  });
});

describe('pickElement', () => {
  it('returns the chosen index', async () => {
    expect(await pickElement(new FakeProvider(['{"index":1}']), 'fp', ['a', 'b'])).toBe(1);
  });
  it.each(['{"index":-1}', '{"index":7}'])('declines for %s', async (raw) => {
    expect(await pickElement(new FakeProvider([raw]), 'fp', ['a', 'b'])).toBeUndefined();
  });
});

describe('draftBugReport', () => {
  const input = { title: 'checkout', steps: ['log in', 'buy'], errorMessage: 'boom' };
  it('uses the template when no model is available', async () => {
    const report = await draftBugReport(input);
    expect(report).toContain('## Steps to reproduce\n1. log in\n2. buy');
    expect(report).toContain('boom');
  });
  it('uses the model text when one is available', async () => {
    expect(await draftBugReport(input, new FakeProvider(['## Summary\nfrom model']))).toBe(
      '## Summary\nfrom model',
    );
  });
});
