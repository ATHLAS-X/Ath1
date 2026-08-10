/* Re-exports the dashboard helpers — canonical implementations live in score-utils.ts */
export { AVA_COLORS, initials, scoreColor, relativeTime, roleColor, calcAge } from "./score-utils";
export { getRedirectByRole } from "./auth-redirect";

import { scoreColor as _scoreColor } from "./score-utils";

export function scoreRingSVG(score: number, size: number, strokeW: number) {
  const cx = size / 2, cy = size / 2;
  const r = (size - strokeW) / 2 - 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const col = _scoreColor(score);
  return { cx, cy, r, circ, fill, col };
}
