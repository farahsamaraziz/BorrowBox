const { query } = require('../config/db');

// The trust score is never stored: it is AVG(rating) over the reviews where
// reviewee_id = the user. Returns null (not 0) when nobody has reviewed them yet.
async function getTrustStats(userId) {
  const { rows } = await query(
    `SELECT ROUND(AVG(rating)::numeric, 2)::float8 AS trust_score,
            COUNT(*)::int                          AS review_count
     FROM reviews WHERE reviewee_id = $1`,
    [userId]
  );
  return { trust_score: rows[0].trust_score, review_count: rows[0].review_count };
}

module.exports = { getTrustStats };
