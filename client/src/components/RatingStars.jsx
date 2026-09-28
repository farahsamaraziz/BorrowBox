export default function RatingStars({ value, size = 14 }) {
  const rounded = Math.round(value || 0);
  return (
    <span
      aria-label={value ? `${value} out of 5` : 'No ratings yet'}
      style={{ fontSize: size, color: '#C77A1F', letterSpacing: '1px' }}
    >
      {'★'.repeat(rounded)}
      <span style={{ color: '#D8DCE4' }}>{'★'.repeat(5 - rounded)}</span>
    </span>
  );
}
