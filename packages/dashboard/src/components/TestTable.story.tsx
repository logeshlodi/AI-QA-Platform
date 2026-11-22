import { TESTS } from '../stories/sample';
import { TestTable } from './TestTable';

export const MixedRun = () => <TestTable tests={TESTS} />;
export const AllPassed = () => <TestTable tests={TESTS.filter((t) => t.status === 'passed')} />;
