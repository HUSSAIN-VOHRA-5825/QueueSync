const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const ActivityLog = require('../models/ActivityLog');
const { getQueueLiveStats } = require('../services/queueService');

// get all queues with query search and pagination
exports.getQueues = async (req, res, next) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    const query = {};

    // check search matching name or code
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await Queue.countDocuments(query);
    const queues = await Queue.find(query)
      .populate('createdBy', 'name')
      .skip(skip)
      .limit(limitNumber)
      .sort({ createdAt: -1 });

    // load counts and serving tokens for list cards
    const queuesWithStats = await Promise.all(
      queues.map(async (queue) => {
        const stats = await getQueueLiveStats(queue._id);
        return {
          ...queue.toObject(),
          stats,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: queues.length,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / limitNumber),
      },
      data: queuesWithStats,
    });
  } catch (error) {
    next(error);
  }
};

// get single queue status and user position in line
exports.getQueue = async (req, res, next) => {
  try {
    const queue = await Queue.findById(req.params.id).populate('createdBy', 'name');
    if (!queue) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    const stats = await getQueueLiveStats(queue._id);

    // check if user has active entry
    const userActiveEntry = await QueueEntry.findOne({
      queueId: queue._id,
      userId: req.user.id,
      status: { $in: ['waiting', 'serving'] },
    });

    let userPosition = null;
    if (userActiveEntry && userActiveEntry.status === 'waiting') {
      // count users joined before current user
      const countAhead = await QueueEntry.countDocuments({
        queueId: queue._id,
        status: 'waiting',
        joinedAt: { $lt: userActiveEntry.joinedAt },
      });
      userPosition = countAhead + 1;
    } else if (userActiveEntry && userActiveEntry.status === 'serving') {
      userPosition = 0; // currently serving
    }

    // load active waitlist for admin monitor panel
    const waitingEntries = await QueueEntry.find({
      queueId: queue._id,
      status: 'waiting',
    })
      .populate('userId', 'name email')
      .sort({ joinedAt: 1 });

    res.status(200).json({
      success: true,
      data: {
        ...queue.toObject(),
        stats,
        userActiveEntry,
        userPosition,
        waitingEntries,
      },
    });
  } catch (error) {
    next(error);
  }
};

// create a queue profile
exports.createQueue = async (req, res, next) => {
  try {
    const { name, description, code, capacityLimit, defaultServiceTime } = req.body;

    // confirm code is unique
    const codeExists = await Queue.findOne({ code: code.toUpperCase() });
    if (codeExists) {
      return res.status(400).json({ success: false, error: 'Queue short code already exists' });
    }

    const queue = await Queue.create({
      name,
      description,
      code: code.toUpperCase(),
      capacityLimit: capacityLimit || 0,
      defaultServiceTime: defaultServiceTime || 5,
      createdBy: req.user.id,
    });

    // record system log
    await ActivityLog.create({
      queueId: queue._id,
      action: 'created',
      performedBy: req.user.id,
      details: `Queue "${name}" created with code ${code}`,
    });

    res.status(201).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

// pause/resume/close service counter
exports.updateQueueStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'paused', 'closed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    let queue = await Queue.findById(req.params.id);
    if (!queue) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    const oldStatus = queue.status;
    queue.status = status;
    await queue.save();

    // record system log
    await ActivityLog.create({
      queueId: queue._id,
      action: status === 'active' ? 'resumed' : status === 'paused' ? 'paused' : 'deleted',
      performedBy: req.user.id,
      details: `Queue status changed from ${oldStatus} to ${status}`,
    });

    // broadcast update to customers in real time
    const io = req.app.get('io');
    const liveStats = await getQueueLiveStats(queue._id);
    if (io) {
      io.to(`queue:${queue._id}`).emit('queue_update', liveStats);
      io.to(`queue:${queue._id}`).emit('queue_state_change', {
        queueId: queue._id,
        status,
        message: `Queue "${queue.name}" is now ${status}`,
      });
    }

    res.status(200).json({
      success: true,
      data: queue,
    });
  } catch (error) {
    next(error);
  }
};

// remove queue and clear active users
exports.deleteQueue = async (req, res, next) => {
  try {
    const queue = await Queue.findById(req.params.id);
    if (!queue) {
      return res.status(404).json({ success: false, error: 'Queue not found' });
    }

    // cancel remaining waiting tickets
    await QueueEntry.updateMany(
      { queueId: queue._id, status: { $in: ['waiting', 'serving'] } },
      { status: 'left', serviceEndedAt: new Date() }
    );

    // record log
    await ActivityLog.create({
      queueId: queue._id,
      action: 'deleted',
      performedBy: req.user.id,
      details: `Queue "${queue.name}" was deleted.`,
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`queue:${queue._id}`).emit('queue_deleted', {
        queueId: queue._id,
        message: `Queue "${queue.name}" has been deleted by an administrator.`,
      });
    }

    // remove queue record
    await Queue.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {},
      message: 'Queue and active entries successfully removed',
    });
  } catch (error) {
    next(error);
  }
};
