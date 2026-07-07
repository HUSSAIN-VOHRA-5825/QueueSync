import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { SocketContext } from '../context/SocketContext';
import { NotificationContext } from '../context/NotificationContext';
import { 
  PlusCircle, Play, Pause, Trash2, ArrowRight, UserCheck, 
  Users, CheckCircle, RefreshCw, Star, XCircle, ChevronRight, AlertTriangle
} from 'lucide-react';

const AdminDashboard = () => {
  const { token } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const { addToast } = useContext(NotificationContext);

  // States
  const [queues, setQueues] = useState([]);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [queueStats, setQueueStats] = useState(null);
  const [waitingList, setWaitingList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form States for creating a Queue
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [capacityLimit, setCapacityLimit] = useState(0);
  const [defaultServiceTime, setDefaultServiceTime] = useState(5);
  const [createError, setCreateError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);

  // Fetch all queues administered
  const fetchQueues = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/queues', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQueues(data.data);
        if (data.data.length > 0 && !selectedQueueId) {
          setSelectedQueueId(data.data[0]._id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch live stats & waiting list for the selected queue
  const fetchQueueDetails = async (queueId) => {
    if (!queueId) return;
    try {
      // 1. Get queue live stats
      const resStats = await fetch(`http://localhost:5000/api/queues/${queueId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const dataStats = await resStats.json();
      if (dataStats.success) {
        setQueueStats(dataStats.data.stats);
      }

      // 2. Get active waiting list details for monitoring
      const resList = await fetch(`http://localhost:5000/api/analytics/logs/${queueId}?limit=10`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // fetch queue logs
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadAdmin = async () => {
      setLoading(true);
      await fetchQueues();
      setLoading(false);
    };
    loadAdmin();
  }, [token]);

  useEffect(() => {
    if (selectedQueueId) {
      fetchQueueDetails(selectedQueueId);
      // Join socket room for active dashboard updates
      if (socket) {
        socket.emit('join_queue_room', selectedQueueId);
      }
    }
    return () => {
      if (socket && selectedQueueId) {
        socket.emit('leave_queue_room', selectedQueueId);
      }
    };
  }, [selectedQueueId, socket]);

  // Socket updates listener
  useEffect(() => {
    if (!socket) return;
    socket.on('queue_update', (updatedStats) => {
      if (updatedStats.queueId === selectedQueueId) {
        setQueueStats(updatedStats);
        // Refresh details (including waiting list)
        fetchQueueDetails(selectedQueueId);
      }
      // Keep lists of queues updated
      fetchQueues();
    });

    return () => {
      socket.off('queue_update');
    };
  }, [socket, selectedQueueId]);

  // Handle Queue Creation
  const handleCreateQueue = async (e) => {
    e.preventDefault();
    setCreateError('');
    if (!name || !code) {
      setCreateError('Name and short code are required.');
      return;
    }
    try {
      const res = await fetch('http://localhost:5000/api/queues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          code,
          description,
          capacityLimit,
          defaultServiceTime
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('Queue Created', `Queue "${name}" created successfully.`, 'status_update');
        setName('');
        setCode('');
        setDescription('');
        setCapacityLimit(0);
        setDefaultServiceTime(5);
        setShowCreateForm(false);
        await fetchQueues();
      } else {
        setCreateError(data.error || 'Failed to create queue.');
      }
    } catch (err) {
      console.error(err);
      setCreateError('Network error occurred.');
    }
  };

  // Serve Next Customer
  const handleServeNext = async () => {
    if (!selectedQueueId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/entries/serve-next/${selectedQueueId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        if (data.data) {
          addToast('Serving Customer', `Now serving Ticket #${data.data.tokenNumber}!`, 'status_update');
        } else {
          addToast('Queue Empty', 'No customer is currently waiting in line.', 'status_update');
        }
        await fetchQueueDetails(selectedQueueId);
      } else {
        addToast('Action Failed', data.error || 'Could not serve next customer', 'status_update');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Complete Service
  const handleCompleteService = async () => {
    if (!selectedQueueId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/entries/complete/${selectedQueueId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Service Completed', 'Customer marked as completed.', 'status_update');
        await fetchQueueDetails(selectedQueueId);
      } else {
        addToast('Action Failed', data.error || 'No active serving customer', 'status_update');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Skip Customer
  const handleSkipService = async () => {
    if (!selectedQueueId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/entries/skip/${selectedQueueId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Customer Skipped', 'Customer marked as skipped.', 'status_update');
        await fetchQueueDetails(selectedQueueId);
      } else {
        addToast('Action Failed', data.error || 'No active serving customer', 'status_update');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  // Pause / Resume Queue Status
  const handleToggleStatus = async (queueId, currentStatus) => {
    const nextStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      const res = await fetch(`http://localhost:5000/api/queues/${queueId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success) {
        addToast('Status Changed', `Queue is now ${nextStatus}.`, 'status_update');
        await fetchQueues();
        if (queueId === selectedQueueId) {
          await fetchQueueDetails(queueId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Queue
  const handleDeleteQueue = async (queueId) => {
    if (!window.confirm('Are you sure you want to delete this queue? All active entries will be canceled.')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/queues/${queueId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        addToast('Queue Deleted', 'Queue has been deleted.', 'status_update');
        setSelectedQueueId('');
        setQueueStats(null);
        await fetchQueues();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch details function with waitingList inclusion
  const refreshDetails = async () => {
    if (!selectedQueueId) return;
    try {
      const res = await fetch(`http://localhost:5000/api/queues/${selectedQueueId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQueueStats(data.data.stats);
        setWaitingList(data.data.waitingEntries || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (selectedQueueId) {
      refreshDetails();
    }
  }, [selectedQueueId]);

  const currentQueue = queues.find(q => q._id === selectedQueueId);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header and Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Queue Administration</h1>
          <p className="text-xs text-slate-400 mt-1">Manage physical queues, control flows, and serve customers</p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg flex items-center gap-2 premium-glow transition-all"
        >
          <PlusCircle size={16} />
          Create New Queue
        </button>
      </div>

      {/* Create Queue Form Modal */}
      {showCreateForm && (
        <div className="mb-8 glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 animate-fade-in">
          <h3 className="text-lg font-bold text-white mb-4">Create Queue Profile</h3>
          <form onSubmit={handleCreateQueue} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {createError && (
              <div className="col-span-full flex items-center gap-2 p-4 rounded-xl bg-red-950/40 border border-red-900/50 text-red-400 text-xs">
                <AlertTriangle size={16} />
                <span>{createError}</span>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Queue Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bank Counter A"
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 px-4 py-3 rounded-xl focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Short Code Prefix</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. BANK-A"
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 px-4 py-3 rounded-xl focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600 uppercase"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Default Service Time (Minutes)</label>
              <input
                type="number"
                min="1"
                required
                value={defaultServiceTime}
                onChange={(e) => setDefaultServiceTime(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 px-4 py-3 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief details about counter service"
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 px-4 py-3 rounded-xl focus:border-blue-500 focus:outline-none transition-all placeholder-slate-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Capacity Limit (0 for unlimited)</label>
              <input
                type="number"
                min="0"
                value={capacityLimit}
                onChange={(e) => setCapacityLimit(parseInt(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 px-4 py-3 rounded-xl focus:border-blue-500 focus:outline-none transition-all"
              />
            </div>

            <div className="col-span-full flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-850 hover:bg-slate-900 text-slate-400 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold"
              >
                Publish Queue
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Panel layout */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500">
          <RefreshCw size={24} className="animate-spin mb-2" />
          <p className="text-xs">Loading queue list...</p>
        </div>
      ) : queues.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-3xl border border-slate-800">
          <Users size={36} className="text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-400">No queues configured yet</p>
          <p className="text-xs text-slate-500 mt-1">Get started by creating a queue using the button above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Side Selector */}
          <div className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Queue Profiles</h2>
            <div className="flex flex-col gap-2">
              {queues.map((q) => (
                <button
                  key={q._id}
                  onClick={() => setSelectedQueueId(q._id)}
                  className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${
                    selectedQueueId === q._id
                      ? 'bg-blue-950/10 border-blue-500/50 shadow-md'
                      : 'bg-slate-900/40 border-slate-800 hover:border-slate-700/50'
                  }`}
                >
                  <div>
                    <h3 className="font-bold text-xs text-slate-100">{q.name}</h3>
                    <p className="text-[10px] text-slate-500 mt-0.5 font-mono">{q.code}</p>
                  </div>
                  <ChevronRight size={14} className={selectedQueueId === q._id ? 'text-blue-400' : 'text-slate-600'} />
                </button>
              ))}
            </div>
          </div>

          {/* Console / Active Serving Station */}
          {selectedQueueId && queueStats && (
            <div className="lg:col-span-2 space-y-6">
              {/* Stats overview banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="glass-panel p-4 rounded-2xl border border-slate-850">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Waiting</span>
                  <p className="text-2xl font-black text-blue-400 mt-1">{queueStats.waitingCount}</p>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-slate-850">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Serving</span>
                  <p className="text-2xl font-black text-purple-400 mt-1">{queueStats.servingCount}</p>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-slate-850">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Completed</span>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{queueStats.completedCount}</p>
                </div>
                <div className="glass-panel p-4 rounded-2xl border border-slate-850">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Avg Service</span>
                  <p className="text-2xl font-black text-amber-400 mt-1">{queueStats.avgServiceTime}m</p>
                </div>
              </div>

              {/* Servicing Console panel */}
              <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  {currentQueue && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleToggleStatus(currentQueue._id, currentQueue.status)}
                        className={`p-2 rounded-lg text-xs font-semibold flex items-center gap-1 border transition-all ${
                          currentQueue.status === 'active'
                            ? 'bg-amber-950/20 text-amber-400 border-amber-900/30 hover:bg-amber-900/20'
                            : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30 hover:bg-emerald-900/20'
                        }`}
                      >
                        {currentQueue.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                        {currentQueue.status === 'active' ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleDeleteQueue(currentQueue._id)}
                        className="p-2 rounded-lg bg-red-950/20 text-red-400 border border-red-900/30 hover:bg-red-900/20 text-xs font-semibold flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
                  Servicing Panel
                </span>
                <h2 className="text-xl font-black text-slate-100 mb-6">{currentQueue?.name}</h2>

                {/* Now Serving Screen */}
                <div className="p-6 bg-slate-950 rounded-2xl border border-slate-850 flex flex-col items-center justify-center text-center my-6">
                  {queueStats.currentServing ? (
                    <div className="animate-fade-in space-y-3">
                      <span className="text-[10px] font-bold uppercase bg-purple-600/20 border border-purple-500/30 text-purple-400 px-3 py-1 rounded-full animate-pulse">
                        Now Serving Counter
                      </span>
                      <h3 className="text-5xl font-black text-white mt-2">
                        #{queueStats.currentServing.tokenNumber}
                      </h3>
                      <p className="text-sm font-bold text-slate-200 mt-2">
                        {queueStats.currentServing.userName}
                      </p>
                      <span className="text-xs text-slate-500 block">
                        Called at:{' '}
                        {new Date(queueStats.currentServing.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                  ) : (
                    <div className="py-6 space-y-2">
                      <p className="text-slate-500 text-sm font-bold">No customer is currently called</p>
                      <p className="text-xs text-slate-600">Click "Serve Next Customer" to pull the next ticket.</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-4 mt-6">
                  <button
                    onClick={handleServeNext}
                    disabled={actionLoading || currentQueue?.status !== 'active'}
                    className={`flex-1 min-w-[150px] py-4 rounded-xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all ${
                      currentQueue?.status !== 'active'
                        ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-500 text-white premium-glow hover:scale-[1.01]'
                    }`}
                  >
                    <UserCheck size={18} />
                    Serve Next Customer
                  </button>

                  <button
                    onClick={handleCompleteService}
                    disabled={actionLoading || !queueStats.currentServing}
                    className={`px-6 py-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all ${
                      !queueStats.currentServing
                        ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20'
                    }`}
                  >
                    <CheckCircle size={18} />
                    Mark Completed
                  </button>

                  <button
                    onClick={handleSkipService}
                    disabled={actionLoading || !queueStats.currentServing}
                    className={`px-6 py-4 rounded-xl font-bold text-sm border flex items-center justify-center gap-2 transition-all ${
                      !queueStats.currentServing
                        ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-amber-600/10 border-amber-500/30 text-amber-400 hover:bg-amber-600/20'
                    }`}
                  >
                    <XCircle size={18} />
                    Skip Service
                  </button>
                </div>
              </div>

              {/* Waiting list monitor */}
              <div className="glass-panel p-6 rounded-2xl border border-slate-800">
                <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Users size={16} className="text-slate-400" />
                  Active Users Monitor ({waitingList.length} waiting)
                </h3>

                {waitingList.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">No users currently waiting in line.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-500 uppercase text-[10px] font-bold">
                          <th className="pb-3 font-semibold">Token</th>
                          <th className="pb-3 font-semibold">Customer</th>
                          <th className="pb-3 font-semibold">Joined At</th>
                          <th className="pb-3 font-semibold text-right">Estimated Wait</th>
                        </tr>
                      </thead>
                      <tbody>
                        {waitingList.map((entry, index) => (
                          <tr key={entry._id} className="border-b border-slate-900/50 hover:bg-slate-900/20 transition-all">
                            <td className="py-3 font-mono font-bold text-blue-400">#{entry.tokenNumber}</td>
                            <td className="py-3 font-semibold text-slate-200">{entry.userId?.name || 'Customer'}</td>
                            <td className="py-3 text-slate-500">
                              {new Date(entry.joinedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-3 text-right font-bold text-slate-400">
                              ~{Math.round((index + 0.5) * queueStats.avgServiceTime)} mins
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
