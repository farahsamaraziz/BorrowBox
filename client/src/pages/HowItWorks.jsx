const STEPS = [
  {
    title: 'List or search',
    body: 'Lend something by listing it with a photo, condition and a maximum number of days. Borrow by searching, optionally narrowed to the dates you need.',
  },
  {
    title: 'Send a request',
    body: 'Pick your dates on the item page. Booked dates are blocked automatically, so you can only request what is actually free.',
  },
  {
    title: 'Owner approves',
    body: "The owner gets the request and approves or rejects it. Approving one request automatically rejects any other pending request for the same dates.",
  },
  {
    title: 'Handover',
    body: "When you pick the item up, the owner logs its condition. That note is kept with the booking as a record both sides can refer back to.",
  },
  {
    title: 'Return',
    body: 'Bring it back by the end date and the owner logs its condition again. Bringing it back late marks the booking overdue on both dashboards until it is returned.',
  },
  {
    title: 'Rate each other',
    body: "Once a booking is returned, both sides can leave a rating and a short comment. Ratings build the trust score shown on every profile and item.",
  },
];

export default function HowItWorks() {
  return (
    <div className="container" style={{ paddingTop: 48, paddingBottom: 64 }}>
      <div style={{ maxWidth: 640, marginBottom: 40 }}>
        <h1 style={{ marginBottom: 12 }}>How BorrowBox works</h1>
        <p>
          A short loop of borrow, hand over, return and rate — with every date, condition note
          and rating kept on the record so nothing has to be taken on trust alone.
        </p>
      </div>

      <div className="stack" style={{ gap: 0, maxWidth: 640 }}>
        {STEPS.map((step, i) => (
          <div key={step.title} className="row" style={{ gap: 18, alignItems: 'flex-start', padding: '18px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
            <span
              className="mono"
              style={{
                width: 30, height: 30, flex: '0 0 auto', borderRadius: '50%',
                background: 'var(--navy)', color: 'white', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem',
              }}
            >
              {i + 1}
            </span>
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: 4 }}>{step.title}</h3>
              <p className="text-sm">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
