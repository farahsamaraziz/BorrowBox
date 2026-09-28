// Helpers for 'YYYY-MM-DD' calendar-date strings (no time zones involved).

function toUtcMs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

// Number of calendar days a booking covers, both ends inclusive.
// 2026-09-24 -> 2026-09-26 is 3 days.
function daysInclusive(start, end) {
  return Math.round((toUtcMs(end) - toUtcMs(start)) / 86400000) + 1;
}

module.exports = { daysInclusive };
