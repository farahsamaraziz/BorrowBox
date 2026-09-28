const LABELS = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved',
  PICKED_UP: 'Picked up',
  RETURNED: 'Returned',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

// `overdue` is the computed flag from the API (still PICKED_UP after end_date).
export default function StatusBadge({ status, overdue = false }) {
  return (
    <>
      <span className={`status-badge status-${status}`}>{LABELS[status] || status}</span>
      {overdue && <span className="status-badge status-OVERDUE" title="The end date has passed">Overdue</span>}
    </>
  );
}
