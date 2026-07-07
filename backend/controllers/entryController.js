const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { getQueueLiveStats, calculateWaitTimeForUser } = require('../services/queueService');

// helper for real time alerts
const sendNotification = async (io, userId, title, message, type = 'status_update') => {
  try {
    const notification = await Notification.create({
      userId,
      title,
      message,
      type,
    });

    if (io) {
      io.to(`user:${userId}`).emit('notification_received', notification);
    }
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error.message);
  }
};

// helper for queue status room updates
const broadcastQueueUpdate = async (io, queueId) => {
  if (io) {
    const stats = await getQueueLiveStats(queueId);
    io.to(`queue:${queueId}`).emit('queue_update', stats);
  }
};

// user joins a queue remotely
exports.joinQueue = async (req, res, next) => {
  try {
    const queueId = req.params.queueId;
    const userId = req.user.id;

    // confirm queue exists
    const queue = await Queue.findById(queueId);
    if (!queue) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    if (queue.status !== 'active') {
      return res.status(400).json({ success: false, error: 'Queue is currently paused or closed' });
    }

    // prevent joining twice
    const activeEntry = await QueueEntry.findOne({
      queueId,
      userId,
      status: { $in: ['waiting', 'serving'] },
    });

    if (activeEntry) {
      return res.status(400).json({ success: false, error: 'You are already in this queue' });
    }

    // check queue capacity
    if (queue.capacityLimit > 0) {
      const activeCount = await QueueEntry.countDocuments({
        queueId,
        status: { $in: ['waiting', 'serving'] },
      });
      if (activeCount >= queue.capacityLimit) {
        return res.status(400).json({ success: false, error: 'Queue is at full capacity' });
      }
    }

    // calculate next token number
    const lastEntry = await QueueEntry.findOne({ queueId }).sort({ tokenNumber: -1 });
    const tokenNumber = lastEntry ? lastEntry.tokenNumber + 1 : 1;

    const entry = await QueueEntry.create({
      queueId,
      userId,
      tokenNumber,
      status: 'waiting',
    });

    // log log activity
    await ActivityLog.create({
      queueId,
      action: 'joined',
      performedBy: userId,
      details: `User joined queue "${queue.name}" with Token #${tokenNumber}`,
    });

    const io = req.app.get('io');
    await sendNotification(
      io,
      userId,
      'Queue Joined',
      `You joined queue "${queue.name}". Your Token Number is #${tokenNumber}.`,
      'status_update'
    );

    // broadcast update
    await broadcastQueueUpdate(io, queueId);

    // get wait estimation
    const estWaitTime = await calculateWaitTimeForUser(queueId, userId);

    res.status(201).json({
      success: true,
      data: {
        entry,
        estimatedWaitTime: estWaitTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

// user leaves a queue remotely
exports.leaveQueue = async (req, res, next) => {
  try {
    const queueId = req.params.queueId;
    const userId = req.user.id;

    const entry = await QueueEntry.findOne({
      queueId,
      userId,
      status: { $in: ['waiting', 'serving'] },
    });

    if (!entry) {
      return res.status(404).json({ success: false, error: 'Active entry in this queue not found' });
    }

    entry.status = 'left';
    entry.serviceEndedAt = new Date();
    await entry.save();

    const queue = await Queue.findById(queueId);

    // log log activity
    await ActivityLog.create({
      queueId,
      action: 'left',
      performedBy: userId,
      details: `User left queue "${queue ? queue.name : queueId}" (Token #${entry.tokenNumber})`,
    });

    const io = req.app.get('io');
    await sendNotification(
      io,
      userId,
      'Queue Left',
      `You left the queue "${queue ? queue.name : 'Queue'}".`,
      'status_update'
    );

    // broadcast update
    await broadcastQueueUpdate(io, queueId);

    res.status(200).json({
      success: true,
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

// get user active tickets
exports.getActiveEntries = async (req, res, next) => {
  try {
    const activeEntries = await QueueEntry.find({
      userId: req.user.id,
      status: { $in: ['waiting', 'serving'] },
    }).populate('queueId');

    const activeWithEstimations = await Promise.all(
      activeEntries.map(async (entry) => {
        if (!entry.queueId) return null;
        const estWaitTime = await calculateWaitTimeForUser(entry.queueId._id, req.user.id);
        const stats = await getQueueLiveStats(entry.queueId._id);

        let userPosition = null;
        if (entry.status === 'waiting') {
          const countAhead = await QueueEntry.countDocuments({
            queueId: entry.queueId._id,
            status: 'waiting',
            joinedAt: { $lt: entry.joinedAt },
          });
          userPosition = countAhead + 1;
        } else {
          userPosition = 0;
        }

        return {
          ...entry.toObject(),
          estimatedWaitTime: estWaitTime,
          userPosition,
          stats,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: activeWithEstimations.filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};

// get user past queue joins history
exports.getHistory = async (req, res, next) => {
  try {
    const history = await QueueEntry.find({
      userId: req.user.id,
      status: { $in: ['completed', 'left', 'skipped'] },
    })
      .populate('queueId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

// serve next ticket (admin only)
exports.serveNext = async (req, res, next) => {
  try {
    const queueId = req.params.queueId;
    const adminId = req.user.id;

    const queue = await Queue.findById(queueId);
    if (!queue) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    const io = req.app.get('io');

    // autocomplete current serving customer if exists
    const activeServing = await QueueEntry.findOne({
      queueId,
      status: 'serving',
    });

    if (activeServing) {
      activeServing.status = 'completed';
      activeServing.serviceEndedAt = new Date();
      await activeServing.save();

      // log completed log
      await ActivityLog.create({
        queueId,
        action: 'completed',
        performedBy: adminId,
        details: `Serving Completed for Token #${activeServing.tokenNumber}`,
      });

      await sendNotification(
        io,
        activeServing.userId,
        'Service Completed',
        `Your service in "${queue.name}" has been marked completed. Thank you!`,
        'status_update'
      );
    }

    // select next ticket in line
    const nextEntry = await QueueEntry.findOne({
      queueId,
      status: 'waiting',
    })
      .populate('userId', 'name email')
      .sort({ joinedAt: 1 });

    if (!nextEntry) {
      // broadcast clean update
      await broadcastQueueUpdate(io, queueId);
      return res.status(200).json({
        success: true,
        message: 'No more customers in queue to serve.',
        data: null,
      });
    }

    // pull next ticket into serving state
    nextEntry.status = 'serving';
    nextEntry.serviceStartedAt = new Date();
    nextEntry.servedBy = adminId;
    await nextEntry.save();

    // log log activity
    await ActivityLog.create({
      queueId,
      action: 'serving',
      performedBy: adminId,
      details: `Called Token #${nextEntry.tokenNumber} to counter`,
    });

    // push alerts to client user room
    if (io) {
      io.to(`user:${nextEntry.userId._id}`).emit('user_serving_alert', {
        queueId,
        queueName: queue.name,
        tokenNumber: nextEntry.tokenNumber,
        message: `It is your turn! Please proceed to the counter in queue "${queue.name}".`,
      });
    }

    await sendNotification(
      io,
      nextEntry.userId._id,
      'It is Your Turn!',
      `Please proceed to the counter. You are now being served in "${queue.name}"!`,
      'serving_alert'
    );

    // broadcast update to customers in room
    await broadcastQueueUpdate(io, queueId);

    res.status(200).json({
      success: true,
      message: `Token #${nextEntry.tokenNumber} is now being served.`,
      data: nextEntry,
    });
  } catch (error) {
    next(error);
  }
};

// complete active ticket serving (admin only)
exports.completeService = async (req, res, next) => {
  try {
    const queueId = req.params.queueId;
    const adminId = req.user.id;

    const entry = await QueueEntry.findOne({
      queueId,
      status: 'serving',
    });

    if (!entry) {
      return res.status(400).json({ success: false, error: 'No customer is currently being served in this queue' });
    }

    entry.status = 'completed';
    entry.serviceEndedAt = new Date();
    await entry.save();

    const queue = await Queue.findById(queueId);

    // log activity
    await ActivityLog.create({
      queueId,
      action: 'completed',
      performedBy: adminId,
      details: `Service Completed for Token #${entry.tokenNumber}`,
    });

    const io = req.app.get('io');
    await sendNotification(
      io,
      entry.userId,
      'Service Completed',
      `Your service in "${queue ? queue.name : 'Queue'}" has been marked completed. Thank you!`,
      'status_update'
    );

    await broadcastQueueUpdate(io, queueId);

    res.status(200).json({
      success: true,
      message: 'Service marked as completed.',
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};

// skip active ticket serving (admin only)
exports.skipService = async (req, res, next) => {
  try {
    const queueId = req.params.queueId;
    const adminId = req.user.id;

    const entry = await QueueEntry.findOne({
      queueId,
      status: 'serving',
    });

    if (!entry) {
      return res.status(400).json({ success: false, error: 'No customer is currently being served in this queue' });
    }

    entry.status = 'skipped';
    entry.serviceEndedAt = new Date();
    await entry.save();

    const queue = await Queue.findById(queueId);

    // log log activity
    await ActivityLog.create({
      queueId,
      action: 'skipped',
      performedBy: adminId,
      details: `Token #${entry.tokenNumber} was skipped`,
    });

    const io = req.app.get('io');
    await sendNotification(
      io,
      entry.userId,
      'Service Skipped',
      `You were marked as skipped in "${queue ? queue.name : 'Queue'}". Please contact support if this was an error.`,
      'status_update'
    );

    await broadcastQueueUpdate(io, queueId);

    res.status(200).json({
      success: true,
      message: 'Service marked as skipped.',
      data: entry,
    });
  } catch (error) {
    next(error);
  }
};
