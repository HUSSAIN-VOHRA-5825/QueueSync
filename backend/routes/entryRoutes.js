const express = require('express');
const {
  joinQueue,
  leaveQueue,
  getActiveEntries,
  getHistory,
  serveNext,
  completeService,
  skipService,
} = require('../controllers/entryController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.post('/join/:queueId', joinQueue);
router.post('/leave/:queueId', leaveQueue);
router.get('/active', getActiveEntries);
router.get('/history', getHistory);

// counter management actions
router.post('/serve-next/:queueId', authorize('admin'), serveNext);
router.post('/complete/:queueId', authorize('admin'), completeService);
router.post('/skip/:queueId', authorize('admin'), skipService);

module.exports = router;
