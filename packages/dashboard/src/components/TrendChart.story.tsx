import { DURATION, PASS_RATE } from '../stories/sample';
import { TrendChart } from './TrendChart';

export const PassRate = () => <TrendChart title="Pass rate" unit="%" points={PASS_RATE} min={90} max={100} />;
export const Duration = () => <TrendChart title="Run duration" unit=" s" points={DURATION} />;
export const OnePoint = () => (
  <TrendChart title="Pass rate" unit="%" points={PASS_RATE.slice(-1)} min={0} max={100} />
);
export const Empty = () => <TrendChart title="Pass rate" unit="%" points={[]} />;
/** Same chart on the dark surface: the dark steps are their own, not a flip of the light ones. */
export const PassRateDark = () => (
  <div data-theme="dark" className="aiqa-theme-root">
    <TrendChart title="Pass rate" unit="%" points={PASS_RATE} min={90} max={100} />
  </div>
);
