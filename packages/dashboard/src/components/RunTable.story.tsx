import { RUNS } from '../stories/sample';
import { RunTable } from './RunTable';

export const Recent = () => <RunTable runs={RUNS} caption="Recent runs" hrefFor={(r) => `/runs/${r.id}`} />;
export const Empty = () => <RunTable runs={[]} caption="Recent runs" />;
