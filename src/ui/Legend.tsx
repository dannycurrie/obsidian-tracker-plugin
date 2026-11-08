/**
 * Legend under the header (brief › Screen layout 2): plan tick, filled
 * square = week hit, grey square = week missed. Each swatch has its words.
 */
export function Legend() {
  return (
    <ul class="scoreboard-legend" aria-label="Legend">
      <li class="scoreboard-legend__item">
        <span class="scoreboard-legend__tick" aria-hidden="true" />
        Where the plan says you should be today
      </li>
      <li class="scoreboard-legend__item">
        <span class="scoreboard-legend__square is-hit" aria-hidden="true" />
        Week hit
      </li>
      <li class="scoreboard-legend__item">
        <span class="scoreboard-legend__square is-missed" aria-hidden="true" />
        Week missed
      </li>
    </ul>
  );
}
