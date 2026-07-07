const mongoose = require('mongoose');

const QueueSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a queue name'],
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    code: {
      type: String,
      required: [true, 'Please add a unique short code'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'closed'],
      default: 'active',
    },
    capacityLimit: {
      type: Number,
      default: 0, // 0 means no limit
    },
    defaultServiceTime: {
      type: Number,
      default: 5, // default wait mins
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Queue', QueueSchema);
