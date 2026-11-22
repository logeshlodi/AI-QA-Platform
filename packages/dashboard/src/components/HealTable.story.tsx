import { HEALS } from '../stories/sample';
import { HealTable } from './HealTable';

export const Mixed = () => <HealTable events={HEALS} />;
export const None = () => <HealTable events={[]} />;
