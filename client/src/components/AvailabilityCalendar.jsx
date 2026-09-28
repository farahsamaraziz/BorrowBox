import { useMemo, useState } from 'react';
import { todayStr, rangesOverlap } from '../utils/dates';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// A read-only-ish month calendar: past and booked days are disabled, everything
// else is clickable. First click sets the start date, second click sets the end
// date (or restarts the selection if it's before the current start).
export default function AvailabilityCalendar({ booked, start, end, onSelect }) {
  const startOfThisMonth = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  }, []);
  const [cursor, setCursor] = useState(startOfThisMonth);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = todayStr();

  const isBooked = (key) => booked.some((b) => rangesOverlap(key, key, b.start_date, b.end_date));

  const firstOfMonth = new Date(year, month, 1);
  // Monday-first grid: convert JS's Sunday=0 into an offset from Monday.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const canGoBack = year > startOfThisMonth.getFullYear() || month > startOfThisMonth.getMonth();

  const handleClick = (key) => {
    if (!start || (start && end)) {
      onSelect(key, key);
    } else if (key < start) {
      onSelect(key, key);
    } else {
      onSelect(start, key);
    }
  };

  return (
    <div>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          aria-label="Previous month"
          disabled={!canGoBack}
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          ‹
        </button>
        <span className="mono text-sm" style={{ fontWeight: 600 }}>{MONTH_NAMES[month]} {year}</span>
        <button
          type="button"
          className="btn btn-sm btn-secondary"
          aria-label="Next month"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
        {WEEKDAYS.map((w) => (
          <span key={w} className="mono muted" style={{ fontSize: '0.68rem', textAlign: 'center' }}>{w}</span>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <span key={`b${i}`} />;
          const key = toKey(year, month, d);
          const past = key < today;
          const bookedDay = isBooked(key);
          const disabled = past || bookedDay;
          const inRange = start && end && key >= start && key <= end;
          const isEdge = key === start || key === end;

          let background = 'transparent';
          let color = 'var(--ink)';
          if (bookedDay) { background = 'var(--status-rejected-bg)'; color = 'var(--status-rejected)'; }
          else if (isEdge) { background = 'var(--navy)'; color = 'white'; }
          else if (inRange) { background = 'var(--status-approved-bg)'; color = 'var(--navy)'; }
          else if (past) { color = 'var(--border-strong)'; }

          return (
            <button
              type="button"
              key={key}
              disabled={disabled}
              onClick={() => handleClick(key)}
              title={bookedDay ? 'Already booked' : key}
              style={{
                aspectRatio: '1',
                border: 'none',
                borderRadius: 6,
                fontSize: '0.78rem',
                fontFamily: 'var(--font-mono)',
                background,
                color,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled && !bookedDay ? 0.45 : 1,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="row text-sm muted" style={{ gap: 14, marginTop: 12, fontSize: '0.74rem', flexWrap: 'wrap' }}>
        <Legend color="var(--status-rejected-bg)" border="var(--status-rejected)" label="Booked" />
        <Legend color="var(--navy)" label="Your dates" />
        <Legend color="transparent" border="var(--border-strong)" label="Free" />
      </div>
    </div>
  );
}

function Legend({ color, border, label }) {
  return (
    <span className="row" style={{ gap: 6 }}>
      <span
        style={{
          width: 10, height: 10, borderRadius: 3, background: color,
          border: border ? `1px solid ${border}` : 'none', display: 'inline-block',
        }}
      />
      {label}
    </span>
  );
}
