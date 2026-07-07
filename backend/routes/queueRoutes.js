const express = require('express');
const {
  getQueues,
  getQueue,
  createQueue,
  updateQueueStatus,
  deleteQueue,
} = require('../controllers/queueController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// check authentication
router.use(protect);

router
  .route('/')
  .get(getQueues)
  .post(authorize('admin'), createQueue);

router
  .route('/:id')
  .get(getQueue)
  .delete(authorize('admin'), deleteQueue);

router.put('/:id/status', authorize('admin'), updateQueueStatus);

module.exports = router;
