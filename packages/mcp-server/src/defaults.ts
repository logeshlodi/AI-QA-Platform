import path from 'node:path';
import { chooseModel, JsonlDecisionStore, JsonlRunLog } from '@aiqa/ai-agents';
import { HISTORY_DIR, openRunHistory } from '@aiqa/reporting-engine';
import { createHealRepository } from '@aiqa/self-healing-engine';
import { loadEnv } from '@aiqa/shared';
import type { PlatformData } from './server';

/** Heal audit kept by the UI framework: packages/mcp-server/src -> ../../playwright-framework/.aiqa */
export const HEAL_DIR = path.resolve(__dirname, '..', '..', 'playwright-framework', '.aiqa');

/** The laptop's own data: run history, heal audit, the configured model, the agent run log. */
export function localData(): PlatformData {
  return {
    runs: () => {
      const repo = openRunHistory(HISTORY_DIR);
      try {
        return repo.listRuns(50);
      } finally {
        repo.close();
      }
    },
    heals: () => {
      const repo = createHealRepository(HEAL_DIR);
      try {
        return repo.listEvents();
      } finally {
        repo.close();
      }
    },
    model: chooseModel(loadEnv()),
    log: new JsonlRunLog(),
    decisions: new JsonlDecisionStore(),
  };
}
