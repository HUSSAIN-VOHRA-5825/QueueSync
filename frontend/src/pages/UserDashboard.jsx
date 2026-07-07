import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { NotificationContext } from '../context/NotificationContext';
import { 
  Search, Users, Clock, LogOut, CheckCircle, ArrowRight, 
  HelpCircle, RefreshCw, Eye, Star, AlertCircle, History
} from 'lucide-react';

const UserDashboard = () => {
  const { token, user } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const { addToast } = useContext(NotificationContext);

  const [queues, setQueues] = useState([]);
  const [activeEntry, setActiveEntry] = useState(null);
  const [history, setHistory] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState(null);
  const [leavingId, setLeavingId] = useState(null);

  // Fetch all queues
  const fetchQueues = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/queues?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQueues(data.data);
      }
    } catch (err) {
      console.error('Error fetching queues:', err);
    }
  };

  // Fetch active user entry
  const fetchActiveEntry = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/entries/active', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        setActiveEntry(data.data[0]);
      } else {
        setActiveEntry(null);
      }
    } catch (err) {
      console.error('Error fetching active entry:', err);
    }
  };

  // Fetch user history
  const fetchHistory = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/entries/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  useEffect(() => {
    if (token) {
      const loadDashboard = async () => {
        setLoading(true);
        await Promise.all([fetchQueues(), fetchActiveEntry(), fetchHistory()]);
        setLoading(false);
      };
      loadDashboard();
    }
  }, [token, search]);

  // Handle Socket events
  useEffect(() => {
    if (!socket) return;

    // Listen to queue updates (re-estimate times and positions)
    socket.on('queue_update', (updatedStats) => {
      // 1. Update queue count in the main listing
      setQueues((prevQueues) =>
        prevQueues.map((q) =>
          q._id === updatedStats.queueId
            ? { ...q, stats: updatedStats }
            : q
        )
      );

      // 2. If user is currently in this queue, update user position details
      setActiveEntry((prevActive) => {
        if (prevActive && prevActive.queueId && prevActive.queueId._id === updatedStats.queueId) {
          // Re-estimate position
          fetchActiveEntry(); // Fetch fresh calculations from database
        }
        return prevActive;
      });
    });

    // Listen to direct queue deletions
    socket.on('queue_deleted', (data) => {
      addToast('Queue Closed', data.message, 'queue_state');
      fetchQueues();
      fetchActiveEntry();
    });

    // Listen to direct queue state changes (pause/resume)
    socket.on('queue_state_change', (data) => {
      addToast('Queue Status Update', data.message, 'queue_state');
      fetchQueues();
      fetchActiveEntry();
    });

    // If user is currently in a queue, join its socket room
    if (activeEntry && activeEntry.queueId) {
      socket.emit('join_queue_room', activeEntry.queueId._id);
    }

    return () => {
      socket.off('queue_update');
      socket.off('queue_deleted');
      socket.off('queue_state_change');
    };
  }, [socket, activeEntry?.queueId?._id]);

  // Join a queue
  const handleJoinQueue = async (queueId) => {
    if (activeEntry) {
      addToast('Cannot Join Queue', 'You are already in an active queue. Please leave it first.', 'status_update');
      return;
    }

    setJoiningId(queueId);
    try {
      const res = await fetch(`http://localhost:5000/api/entries/join/${queueId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Joined Queue', 'Successfully joined the queue remotely!', 'status_update');
        await fetchActiveEntry();
        await fetchQueues();
        if (socket) {
          socket.emit('join_queue_room', queueId);
        }
      } else {
        addToast('Error Joining', data.error || 'Failed to join queue', 'status_update');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Connection error occurred', 'status_update');
    } finally {
      setJoiningId(null);
    }
  };

  // Leave a queue
  const handleLeaveQueue = async (queueId) => {
    setLeavingId(queueId);
    try {
      const res = await fetch(`http://localhost:5000/api/entries/leave/${queueId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Queue Left', 'You have left the queue.', 'status_update');
        setActiveEntry(null);
        await fetchQueues();
        await fetchHistory();
        if (socket) {
          socket.emit('leave_queue_room', queueId);
        }
      } else {
        addToast('Error leaving', data.error || 'Failed to leave queue', 'status_update');
      }
    } catch (err) {
      console.error(err);
      addToast('Error', 'Connection error occurred', 'status_update');
    } finally {
      setLeavingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Active Queue Status Section */}
      {activeEntry && (
        <div className="mb-10 animate-fade-in">
          <h2 className="text-sm font-bold tracking-wider uppercase text-slate-400 mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
            Current Active Queue Status
          </h2>
          <div className="glass-panel p-6 sm:p-8 rounded-3xl premium-glow flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-blue-500">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-semibold px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-400 capitalize">
                  {activeEntry.status === 'serving' ? '🚀 Being Served' : '⏳ Waiting in Line'}
                </span>
                <h3 className="text-2xl font-bold text-white mt-2">
                  {activeEntry.queueId?.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Queue Code: <span className="font-mono text-blue-400">{activeEntry.queueId?.code}</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/80 flex items-center justify-center font-extrabold text-blue-400 text-lg border border-slate-800">
                    #{activeEntry.tokenNumber}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Your Token</span>
                    <p className="text-sm font-bold text-slate-300">Ticket Number</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/80 flex items-center justify-center font-extrabold text-purple-400 text-lg border border-slate-800">
                    {activeEntry.userPosition === 0 ? 'Now' : `#${activeEntry.userPosition}`}
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Position</span>
                    <p className="text-sm font-bold text-slate-300">
                      {activeEntry.userPosition === 0 ? 'At the counter' : 'People ahead in line'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-900/80 flex items-center justify-center font-extrabold text-emerald-400 text-lg border border-slate-800">
                    {activeEntry.estimatedWaitTime}m
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Estimated Wait</span>
                    <p className="text-sm font-bold text-slate-300">Minutes left</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress and Action Button */}
            <div className="flex flex-col items-stretch md:items-end justify-between self-stretch gap-4">
              <button
                onClick={() => handleLeaveQueue(activeEntry.queueId._id)}
                disabled={leavingId}
                className="px-6 py-3 bg-red-950/40 border border-red-900/50 hover:bg-red-900/50 text-red-400 hover:text-red-200 font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                {leavingId ? 'Leaving...' : 'Leave Queue'}
              </button>

              <div className="w-full md:w-64">
                <div className="flex justify-between text-[10px] text-slate-500 uppercase font-bold mb-1">
                  <span>Progress</span>
                  <span>
                    {activeEntry.status === 'serving' 
                      ? '100% (Your Turn)' 
                      : `${Math.round(Math.max(1, 100 - (activeEntry.userPosition * 10)))}% Completed`}
                  </span>
                </div>
                <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-500 rounded-full bg-gradient-to-r ${
                      activeEntry.status === 'serving'
                        ? 'from-emerald-500 to-teal-500'
                        : 'from-blue-500 to-purple-500'
                    }`}
                    style={{
                      width: activeEntry.status === 'serving' 
                        ? '100%' 
                        : `${Math.round(Math.max(10, 100 - (activeEntry.userPosition * 10)))}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Queues List Section */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Join a Service Queue</h1>
              <p className="text-xs text-slate-400 mt-1">Select a business queue to join remotely</p>
            </div>
            
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queues..."
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 pl-9 pr-4 py-2.5 rounded-xl focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw size={24} className="animate-spin mb-2" />
              <p className="text-xs">Loading available queues...</p>
            </div>
          ) : queues.length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-3xl border border-slate-800">
              <AlertCircle size={36} className="text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-400">No queues found</p>
              <p className="text-xs text-slate-500 mt-1">Try refining your search keyword.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {queues.map((queue) => {
                const isUserInThisQueue = activeEntry && activeEntry.queueId?._id === queue._id;
                const stats = queue.stats || { waitingCount: 0, avgServiceTime: queue.defaultServiceTime, currentServing: null };
                const isPaused = queue.status === 'paused';
                const isClosed = queue.status === 'closed';

                return (
                  <div
                    key={queue._id}
                    className={`glass-panel p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between gap-4 ${
                      isUserInThisQueue
                        ? 'border-blue-500/50 bg-blue-950/10 shadow-lg'
                        : 'border-slate-800/80 hover:border-slate-700/60'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-blue-400 uppercase">
                          {queue.code}
                        </span>
                        <span
                          className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            isPaused
                              ? 'bg-amber-950/40 text-amber-400 border border-amber-900/50'
                              : isClosed
                              ? 'bg-red-950/40 text-red-400 border border-red-900/50'
                              : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/50'
                          }`}
                        >
                          {queue.status}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base mt-3 leading-snug">
                        {queue.name}
                      </h3>
                      {queue.description && (
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {queue.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 py-2 border-t border-b border-slate-800/50 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Users size={14} className="text-slate-500" />
                        <span>Waiting: <strong className="text-slate-200">{stats.waitingCount}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock size={14} className="text-slate-500" />
                        <span>Wait Time: <strong className="text-slate-200">~{stats.waitingCount * stats.avgServiceTime}m</strong></span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-1">
                      <div className="text-[10px] text-slate-500">
                        Serving: <span className="font-bold text-blue-400">#{stats.currentServing?.tokenNumber || 'None'}</span>
                      </div>

                      {isUserInThisQueue ? (
                        <span className="text-xs text-blue-400 font-bold flex items-center gap-1">
                          <CheckCircle size={14} /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => handleJoinQueue(queue._id)}
                          disabled={joiningId || isPaused || isClosed || activeEntry}
                          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
                            isPaused || isClosed || activeEntry
                              ? 'bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed'
                              : 'bg-slate-100 hover:bg-white text-slate-950 font-bold shadow-md hover:scale-[1.02]'
                          }`}
                        >
                          Join Queue <ArrowRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* History / Stats sidebar */}
        <div className="space-y-6">
          <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
            <h3 className="font-black text-white text-sm tracking-wide uppercase mb-3 flex items-center gap-2">
              <History size={16} className="text-slate-400" />
              Queue Join History
            </h3>
            
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-8">No queue history yet</p>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {history.map((entry) => (
                  <div
                    key={entry._id}
                    className="p-3 bg-slate-900/50 border border-slate-800/50 rounded-xl flex items-center justify-between text-xs hover:border-slate-800 transition-all"
                  >
                    <div>
                      <h4 className="font-bold text-slate-200 line-clamp-1">
                        {entry.queueId?.name || 'Deleted Queue'}
                      </h4>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Token #{entry.tokenNumber} • {new Date(entry.joinedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        entry.status === 'completed'
                          ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30'
                          : entry.status === 'skipped'
                          ? 'bg-amber-950/20 text-amber-400 border border-amber-900/30'
                          : 'bg-slate-950/20 text-slate-400 border border-slate-800/30'
                      }`}
                    >
                      {entry.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-gradient-to-tr from-slate-900/50 to-blue-950/10">
            <h3 className="font-bold text-white text-sm mb-2">💡 Quick Queuing Tips</h3>
            <ul className="text-xs text-slate-400 space-y-2 list-disc pl-4 leading-relaxed">
              <li>You can leave queues at any time by clicking the "Leave Queue" button.</li>
              <li>When your turn is near, you will receive a browser notification alert even if you are on another tab.</li>
              <li>Wait times are dynamic averages calculated based on actual service counters.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
