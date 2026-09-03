// Shared by both the client-side live drag preview (calendar-planning.tsx)
// and the server-side persistence (calendar-entries-move.ts) — the exact
// same "pick up this date, hover over that date, everything strictly
// between shifts by one day toward the gap" algorithm lives in ONE place,
// so what the client previews while dragging always matches what actually
// gets saved. Same interaction as Instagram's "Reorder grid": the days
// themselves never move, but content cascades between them like an array
// insert-with-shift, not a simple two-cell swap.
//
// No React/D1 imports here on purpose — this file has to be safe to import
// from a plain client component AND a server route.

export function buildMonthDates(year: number, month: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

// Returns old-date -> new-date for every occupied slot that moves,
// including the dragged one itself (mapped from originDate to targetDate).
// `monthDates` and `targetDate` must be from the same month as
// `originDate` — the grid never drags across a month boundary.
export function computeReorderShift(
  monthDates: string[],
  originDate: string,
  targetDate: string,
  occupiedDates: ReadonlySet<string>,
): Map<string, string> {
  const moves = new Map<string, string>();
  if (originDate === targetDate) return moves;
  const originIndex = monthDates.indexOf(originDate);
  const targetIndex = monthDates.indexOf(targetDate);
  if (originIndex === -1 || targetIndex === -1) return moves;

  if (targetIndex > originIndex) {
    // Dragging to a later date: everything from just after the origin up
    // to the target shifts one day EARLIER, closing the gap the dragged
    // piece left behind.
    for (let k = originIndex; k < targetIndex; k++) {
      const from = monthDates[k + 1];
      const to = monthDates[k];
      if (occupiedDates.has(from)) moves.set(from, to);
    }
  } else {
    // Dragging to an earlier date: everything from the target up to just
    // before the origin shifts one day LATER.
    for (let k = originIndex; k > targetIndex; k--) {
      const from = monthDates[k - 1];
      const to = monthDates[k];
      if (occupiedDates.has(from)) moves.set(from, to);
    }
  }
  moves.set(originDate, targetDate);
  return moves;
}
