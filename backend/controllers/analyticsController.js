const mongoose = require('mongoose');
const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');
const ActivityLog = require('../models/ActivityLog');
const User = require('../models/User');

// gather dashboard stats overview
exports.getDashboardOverview = async (req, res, next) => {
  try {
    const totalQueues = await Queue.countDocuments();
    const activeEntries = await QueueEntry.countDocuments({ status: { $in: ['waiting', 'serving'] } });
    const totalUsers = await User.countDocuments({ role: 'user' });

    // total done tickets
    const completedCount = await QueueEntry.countDocuments({ status: 'completed' });

    // calculate average time spent serving
    const avgServiceTimeResult = await QueueEntry.aggregate([
      {
        $match: {
          status: 'completed',
          serviceStartedAt: { $exists: true },
          serviceEndedAt: { $exists: true },
        },
      },
      {
        $group: {
          _id: null,
          avgDurationMs: { $avg: { $subtract: ['$serviceEndedAt', '$serviceStartedAt'] } },
        },
      },
    ]);

    const avgServiceTimeMin =
      avgServiceTimeResult.length > 0
        ? Math.round(avgServiceTimeResult[0].avgDurationMs / (1000 * 60) * 10) / 10
        : 0;

    // grouping stats per queue
    const queueBreakdown = await QueueEntry.aggregate([
      {
        $group: {
          _id: '$queueId',
          totalJoined: { $sum: 1 },
          waiting: { $sum: { $cond: [{ $eq: ['$status', 'waiting'] }, 1, 0] } },
          serving: { $sum: { $cond: [{ $eq: ['$status', 'serving'] }, 1, 0] } },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          left: { $sum: { $cond: [{ $eq: ['$status', 'left'] }, 1, 0] } },
          skipped: { $sum: { $cond: [{ $eq: ['$status', 'skipped'] }, 1, 0] } },
        },
      },
    ]);

    // attach metadata details
    const populatedBreakdown = await Promise.all(
      queueBreakdown.map(async (item) => {
        if (!item._id) return null;
        const q = await Queue.findById(item._id).select('name code status');
        if (!q) return null;
        return {
          queueId: q._id,
          name: q.name,
          code: q.code,
          status: q.status,
          ...item,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        totalQueues,
        totalUsers,
        activeEntriesCount: activeEntries,
        completedCount,
        averageServiceTimeMinutes: avgServiceTimeMin,
        queuesBreakdown: populatedBreakdown.filter(Boolean),
      },
    });
  } catch (error) {
    next(error);
  }
};

// get recent logs
exports.getActivityLogs = async (req, res, next) => {
  try {
    const { queueId } = req.params;
    const { limit = 20 } = req.query;

    const query = {};
    if (queueId) {
      query.queueId = queueId;
    }

    const logs = await ActivityLog.find(query)
      .populate('performedBy', 'name email')
      .populate('queueId', 'name code')
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));

    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
};

// get hourly traffic metrics
exports.getPeakHours = async (req, res, next) => {
  try {
    const { queueId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(queueId)) {
      return res.status(400).json({ success: false, error: 'Invalid queue ID' });
    }

    // count how many joins per hour
    const trafficData = await QueueEntry.aggregate([
      {
        $match: {
          queueId: new mongoose.Types.ObjectId(queueId),
        },
      },
      {
        $project: {
          hour: { $hour: '$joinedAt' },
        },
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    // construct 24h day mapping
    const fullDayData = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      count: 0,
    }));

    trafficData.forEach((item) => {
      if (item._id >= 0 && item._id < 24) {
        fullDayData[item._id].count = item.count;
      }
    });

    res.status(200).json({
      success: true,
      data: fullDayData,
    });
  } catch (error) {
    next(error);
  }
};
