const mongoose = require('mongoose');

const QueueEntrySchema = new mongoose.Schema(
  {
    queueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Queue',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tokenNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['waiting', 'serving', 'completed', 'left', 'skipped'],
      default: 'waiting',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    serviceStartedAt: {
      type: Date,
    },
    serviceEndedAt: {
      type: Date,
    },
    servedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// fast lookup indexes
QueueEntrySchema.index({ queueId: 1, userId: 1, status: 1 });

module.exports = mongoose.model('QueueEntry', QueueEntrySchema);
