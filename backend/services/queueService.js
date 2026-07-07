const Queue = require('../models/Queue');
const QueueEntry = require('../models/QueueEntry');

// calculate average service time based on last 5 completions
const getAverageServiceTime = async (queueId, defaultServiceTime = 5) => {
  const completedEntries = await QueueEntry.find({
    queueId,
    status: { $in: ['completed', 'skipped'] },
    serviceStartedAt: { $exists: true },
    serviceEndedAt: { $exists: true },
  })
    .sort({ serviceEndedAt: -1 })
    .limit(5);

  if (completedEntries.length === 0) {
    return defaultServiceTime;
  }

  let totalDurationMs = 0;
  completedEntries.forEach((entry) => {
    totalDurationMs += entry.serviceEndedAt - entry.serviceStartedAt;
  });

  const averageMs = totalDurationMs / completedEntries.length;
  const averageMinutes = averageMs / (1000 * 60);

  return averageMinutes > 0 ? averageMinutes : defaultServiceTime;
};

// calculate wait time for specific user
const calculateWaitTimeForUser = async (queueId, userId) => {
  const queue = await Queue.findById(queueId);
  if (!queue) return 0;

  // check active ticket
  const userEntry = await QueueEntry.findOne({
    queueId,
    userId,
    status: { $in: ['waiting', 'serving'] },
  });

  if (!userEntry) {
    // estimate wait for a new joiner
    const waitingAhead = await QueueEntry.countDocuments({
      queueId,
      status: 'waiting',
    });
    const activeServing = await QueueEntry.findOne({
      queueId,
      status: 'serving',
    });
    const avgServiceTime = await getAverageServiceTime(queueId, queue.defaultServiceTime);
    
    // wait time estimation formula
    const countAhead = waitingAhead + (activeServing ? 0.5 : 0);
    return Math.max(1, Math.round(countAhead * avgServiceTime));
  }

  if (userEntry.status === 'serving') {
    return 0; // being served
  }

  // count how many are ahead
  const waitingAhead = await QueueEntry.countDocuments({
    queueId,
    status: 'waiting',
    joinedAt: { $lt: userEntry.joinedAt },
    _id: { $ne: userEntry._id },
  });

  const activeServing = await QueueEntry.findOne({
    queueId,
    status: 'serving',
  });

  const avgServiceTime = await getAverageServiceTime(queueId, queue.defaultServiceTime);

  // count the active serving ticket
  const countAhead = waitingAhead + (activeServing ? 0.5 : 0);
  return Math.max(1, Math.round(countAhead * avgServiceTime));
};

// aggregate live stats for a queue
const getQueueLiveStats = async (queueId) => {
  const queue = await Queue.findById(queueId);
  if (!queue) return null;

  const [waitingCount, servingCount, completedCount, leftCount, skippedCount] = await Promise.all([
    QueueEntry.countDocuments({ queueId, status: 'waiting' }),
    QueueEntry.countDocuments({ queueId, status: 'serving' }),
    QueueEntry.countDocuments({ queueId, status: 'completed' }),
    QueueEntry.countDocuments({ queueId, status: 'left' }),
    QueueEntry.countDocuments({ queueId, status: 'skipped' }),
  ]);

  // load serving ticket details
  const currentServingEntry = await QueueEntry.findOne({
    queueId,
    status: 'serving',
  })
    .populate('userId', 'name email')
    .sort({ serviceStartedAt: -1 });

  // query average duration
  const avgServiceTime = await getAverageServiceTime(queueId, queue.defaultServiceTime);

  // calculate next ticket number
  const highestTokenEntry = await QueueEntry.findOne({ queueId }).sort({ tokenNumber: -1 });
  const nextTokenNumber = highestTokenEntry ? highestTokenEntry.tokenNumber + 1 : 1;

  return {
    queueId: queue._id,
    name: queue.name,
    code: queue.code,
    status: queue.status,
    capacityLimit: queue.capacityLimit,
    defaultServiceTime: queue.defaultServiceTime,
    waitingCount,
    servingCount,
    completedCount,
    leftCount,
    skippedCount,
    avgServiceTime: Math.round(avgServiceTime * 10) / 10,
    currentServing: currentServingEntry
      ? {
          tokenNumber: currentServingEntry.tokenNumber,
          userId: currentServingEntry.userId._id,
          userName: currentServingEntry.userId.name,
          startedAt: currentServingEntry.serviceStartedAt,
        }
      : null,
    nextTokenNumber,
  };
};

module.exports = {
  getAverageServiceTime,
  calculateWaitTimeForUser,
  getQueueLiveStats,
};
