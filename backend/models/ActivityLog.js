const mongoose = require('mongoose');

const ActivityLogSchema = new mongoose.Schema({
  queueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Queue',
    required: true,
  },
  action: {
    type: String,
    required: true,
    enum: ['created', 'paused', 'resumed', 'deleted', 'joined', 'left', 'serving', 'completed', 'skipped'],
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  details: {
    type: String,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ActivityLog', ActivityLogSchema);
