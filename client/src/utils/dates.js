// Calendar dates are plain 'YYYY-MM-DD' strings end to end, so they can be compared
// with ordinary string comparison and never suffer time-zone shifts.

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Do [aStart, aEnd] and [bStart, bEnd] share at least one day?
export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && aEnd >= bStart;
}

// Days covered by a booking, both ends inclusive.
export function daysInclusive(start, end) {
  const ms = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((ms(end) - ms(start)) / 86400000) + 1;
}

export function formatRange(start, end) {
  return start === end ? start : `${start} → ${end}`;
}
