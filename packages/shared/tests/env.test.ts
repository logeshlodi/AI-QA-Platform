import { describe, expect, it } from 'vitest';
import { ConfigError, parseEnv, resolveTarget } from '../src';

describe('parseEnv', () => {
  it('applies safe defaults when nothing is set', () => {
    const env = parseEnv({});
    expect(env).toMatchObject({ HEAL_MODE: 'suggest', HEAL_THRESHOLD: 0.75, AI_ENABLED: false, CI: false });
  });

  it('coerces strings to typed values', () => {
    const env = parseEnv({ AI_ENABLED: 'true', HEAL_THRESHOLD: '0.9', CI: 'true', HEAL_MODE: 'runtime' });
    expect(env).toMatchObject({ AI_ENABLED: true, HEAL_THRESHOLD: 0.9, CI: true, HEAL_MODE: 'runtime' });
  });

  it('rejects an unknown heal mode and names the variable', () => {
    expect(() => parseEnv({ HEAL_MODE: 'always' })).toThrow(ConfigError);
    expect(() => parseEnv({ HEAL_MODE: 'always' })).toThrow(/HEAL_MODE/);
  });

  it('rejects a threshold outside 0..1', () => {
    expect(() => parseEnv({ HEAL_THRESHOLD: '1.5' })).toThrow(/HEAL_THRESHOLD/);
  });
});

describe('resolveTarget', () => {
  it('returns the hosted URL by default', () => {
    expect(resolveTarget('saucedemo', {}).baseUrl).toBe('https://www.saucedemo.com');
  });

  it('lets an environment variable point a target at a local copy', () => {
    const t = resolveTarget('restfulBooker', { TARGET_RESTFUL_BOOKER_URL: 'http://localhost:3001/' });
    expect(t.baseUrl).toBe('http://localhost:3001');
    expect(t.healthPath).toBe('/ping');
  });
});
