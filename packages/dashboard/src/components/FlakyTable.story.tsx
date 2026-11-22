import { FLAKY } from '../stories/sample';
import { FlakyTable } from './FlakyTable';

export const Some = () => <FlakyTable tests={FLAKY} />;
export const None = () => <FlakyTable tests={[]} />;
