import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { Bar, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  BarChart3, RefreshCw, AlertCircle, TrendingUp, Calendar, CheckSquare, Clock 
} from 'lucide-react';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const Analytics = () => {
  const { token } = useContext(AuthContext);

  // States
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [peakHoursData, setPeakHoursData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPeak, setLoadingPeak] = useState(false);
  const [queues, setQueues] = useState([]);

  // Fetch general metrics
  const fetchDashboard = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/analytics/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.data);
        const breakdown = data.data.queuesBreakdown || [];
        setQueues(breakdown);
        if (breakdown.length > 0 && !selectedQueueId) {
          setSelectedQueueId(breakdown[0].queueId);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
    }
  };

  // Fetch peak traffic hours for the selected queue
  const fetchPeakHours = async (queueId) => {
    if (!queueId) return;
    setLoadingPeak(true);
    try {
      const res = await fetch(`http://localhost:5000/api/analytics/peak-hours/${queueId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPeakHoursData(data.data);
      }
    } catch (err) {
      console.error('Error fetching peak hours:', err);
    } finally {
      setLoadingPeak(false);
    }
  };

  useEffect(() => {
    if (token) {
      const loadAnalytics = async () => {
        setLoading(true);
        await fetchDashboard();
        setLoading(false);
      };
      loadAnalytics();
    }
  }, [token]);

  useEffect(() => {
    if (selectedQueueId) {
      fetchPeakHours(selectedQueueId);
    }
  }, [selectedQueueId]);

  // Chart 1: Queue Volume Breakdown Bar Chart
  const barChartData = {
    labels: queues.map((q) => q.code),
    datasets: [
      {
        label: 'Completed',
        data: queues.map((q) => q.completed),
        backgroundColor: 'rgba(16, 185, 129, 0.65)', // emerald-500
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Abandoned (Left)',
        data: queues.map((q) => q.left),
        backgroundColor: 'rgba(148, 163, 184, 0.5)', // slate-400
        borderColor: 'rgb(148, 163, 184)',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Skipped',
        data: queues.map((q) => q.skipped),
        backgroundColor: 'rgba(245, 158, 11, 0.65)', // amber-500
        borderColor: 'rgb(245, 158, 11)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const barChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: '#cbd5e1' }, // slate-300
      },
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(51, 65, 85, 0.2)' },
      },
      y: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(51, 65, 85, 0.2)' },
      },
    },
  };

  // Chart 2: Peak Traffic Line Chart
  const lineChartData = {
    labels: peakHoursData.map((h) => h.hour),
    datasets: [
      {
        label: 'Hourly Joins Count',
        data: peakHoursData.map((h) => h.count),
        fill: true,
        borderColor: 'rgb(59, 130, 246)', // blue-500
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        tension: 0.4,
        borderWidth: 2,
        pointBackgroundColor: 'rgb(59, 130, 246)',
      },
    ],
  };

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    scales: {
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(51, 65, 85, 0.1)' },
      },
      y: {
        ticks: { color: '#94a3b8', stepSize: 1 },
        grid: { color: 'rgba(51, 65, 85, 0.1)' },
      },
    },
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-500">
        <RefreshCw size={32} className="animate-spin mb-2" />
        <p className="text-sm">Compiling aggregations...</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center py-20">
        <AlertCircle size={48} className="text-red-500 mx-auto mb-2" />
        <p className="text-lg font-bold text-slate-300">Failed to fetch analytics</p>
        <button onClick={fetchDashboard} className="mt-4 px-4 py-2 bg-blue-600 rounded-xl text-xs font-semibold">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">System Analytics</h1>
        <p className="text-xs text-slate-400 mt-1">Aggregated statistics, throughput metrics, and peak traffic tracking</p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="glass-panel p-6 rounded-3xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Total Queues</span>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{dashboardData.totalQueues}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <Calendar size={24} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Active Tickets</span>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{dashboardData.activeEntriesCount}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckSquare size={24} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Served Customers</span>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{dashboardData.completedCount}</h3>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-3xl border border-slate-850 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock size={24} />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500">Avg Service Time</span>
            <h3 className="text-2xl font-extrabold text-white mt-0.5">{dashboardData.averageServiceTimeMinutes}m</h3>
          </div>
        </div>
      </div>

      {/* Charts Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bar Chart Panel */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 size={18} className="text-blue-400" />
            <h3 className="text-sm font-black uppercase text-slate-200 tracking-wide">Queue Load Breakdown</h3>
          </div>
          
          {queues.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-20">No active queue breakdown data to display.</p>
          ) : (
            <Bar data={barChartData} options={barChartOptions} />
          )}
        </div>

        {/* Line Chart Traffic Panel */}
        <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-purple-400" />
              <h3 className="text-sm font-black uppercase text-slate-200 tracking-wide">Peak Business Hours</h3>
            </div>

            {/* Queue Selector for peak traffic */}
            {queues.length > 0 && (
              <select
                value={selectedQueueId}
                onChange={(e) => setSelectedQueueId(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-[11px] text-slate-300 font-bold px-3 py-1.5 rounded-lg focus:border-blue-500 focus:outline-none"
              >
                {queues.map((q) => (
                  <option key={q.queueId} value={q.queueId}>
                    {q.name} ({q.code})
                  </option>
                ))}
              </select>
            )}
          </div>

          {loadingPeak ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
              <RefreshCw size={20} className="animate-spin mb-2" />
              <p className="text-[10px]">Querying traffic data...</p>
            </div>
          ) : peakHoursData.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-20">No traffic logs recorded for this queue.</p>
          ) : (
            <Line data={lineChartData} options={lineChartOptions} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Analytics;
