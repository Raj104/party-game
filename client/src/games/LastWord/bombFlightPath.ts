/**
 * Bomb Buddy travels clockwise around the outside of the player ring.
 * Coordinates are percentages of the existing responsive roundtable.
 * Only initial launch and post-explosion respawns start at table center.
 */
export type FlightPoint = { x: number; y: number };

const CENTER: FlightPoint = { x: 50, y: 50 };
const RADIUS_X = 43;
const RADIUS_Y = 39;
const SEGMENTS = 12;

function seat(index: number, count: number): FlightPoint {
  const angle = (2 * Math.PI * index / count) - Math.PI / 2;
  return {
    x: CENTER.x + RADIUS_X * Math.cos(angle),
    y: CENTER.y + RADIUS_Y * Math.sin(angle),
  };
}

export function bombFlightWaypoints(
  order: readonly string[],
  fromPlayerId: string | null,
  toPlayerId: string | null,
): FlightPoint[] {
  const count = order.length;
  const targetIndex = order.indexOf(toPlayerId ?? "");
  if (count === 0 || targetIndex < 0) return Array.from({ length: SEGMENTS + 1 }, () => ({ ...CENTER }));

  const target = seat(targetIndex, count);
  const sourceIndex = order.indexOf(fromPlayerId ?? "");

  // Initial launch and post-explosion respawn fly STRAIGHT outward from the
  // center. Only normal player-to-player passes use the clockwise perimeter arc.
  if (sourceIndex < 0 || sourceIndex === targetIndex) {
    return Array.from({ length: SEGMENTS + 1 }, (_, index) => {
      const t = index / SEGMENTS;
      return {
        x: CENTER.x + (target.x - CENTER.x) * t,
        y: CENTER.y + (target.y - CENTER.y) * t,
      };
    });
  }

  // Turn order follows the same clockwise order as the roundtable seats.
  // Positive angular travel avoids the diagonal chord through the center,
  // including the last-player -> first-player wrap-around.
  const stepsClockwise = (targetIndex - sourceIndex + count) % count;
  const startAngle = (2 * Math.PI * sourceIndex / count) - Math.PI / 2;
  const sweepAngle = 2 * Math.PI * stepsClockwise / count;
  return Array.from({ length: SEGMENTS + 1 }, (_, index) => {
    const t = index / SEGMENTS;
    const angle = startAngle + sweepAngle * t;
    // Gently bulge *outward*, away from prompts in the table center.
    const outside = 1 + (count === 2 ? 0.02 : 0.09) * Math.sin(Math.PI * t);
    return {
      x: CENTER.x + RADIUS_X * outside * Math.cos(angle),
      y: CENTER.y + RADIUS_Y * outside * Math.sin(angle),
    };
  });
}
