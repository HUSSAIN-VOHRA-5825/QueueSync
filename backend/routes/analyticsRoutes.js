const express = require('express');
const {
  getDashboardOverview,
  getActivityLogs,
  getPeakHours,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', getDashboardOverview);
router.get('/logs', getActivityLogs);
router.get('/logs/:queueId', getActivityLogs);
router.get('/peak-hours/:queueId', getPeakHours);

module.exports = router;
