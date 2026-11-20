/** The quiz topics, one per stop on the learning path (docs/learning/README.md). */
export const TOPICS = [
  'framework',
  'locators',
  'waiting',
  'network',
  'api',
  'data',
  'ai',
  'performance',
  'contracts',
  'security',
  'platform',
] as const;
export type Topic = (typeof TOPICS)[number];

/** core: any automation role. senior: SDET or lead. architect: designing the platform. */
export const LEVELS = ['core', 'senior', 'architect'] as const;
export type Level = (typeof LEVELS)[number];

export interface Question {
  /** Stable id, `<topic>-<n>`, so a score can be recorded against it. */
  id: string;
  topic: Topic;
  level: Level;
  question: string;
  /** The points a strong answer covers, in the order you would say them. */
  outline: string[];
  /** Repository-relative paths that show the answer in working code or a decision record. */
  files: string[];
  /** A break-it lab that practises it, e.g. "04-missing-await". */
  lab?: string;
}
