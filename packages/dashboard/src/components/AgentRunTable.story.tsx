import { AGENT_RUNS } from '../stories/sample';
import { AgentRunTable } from './AgentRunTable';

export const Mixed = () => <AgentRunTable runs={AGENT_RUNS} />;
export const None = () => <AgentRunTable runs={[]} />;
