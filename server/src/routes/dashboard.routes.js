const { Router } = require('express');
const { requireAuth } = require('../middleware/auth');
const { getSummary } = require('../controllers/dashboard.controller');

const router = Router();

router.get('/summary', requireAuth, getSummary);

module.exports = router;
