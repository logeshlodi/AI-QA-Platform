import { StatTile } from './StatTile';

export const Tiles = () => (
  <div className="aiqa-tiles">
    <StatTile label="Pass rate, last run" value="97.5%" hint="ui · 22 Nov" />
    <StatTile label="Failed tests" value="2" />
    <StatTile label="Flaky tests" value="1" hint="passed on retry" />
  </div>
);
