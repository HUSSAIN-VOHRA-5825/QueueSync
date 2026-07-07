import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { NotificationContext } from '../context/NotificationContext';
import { Bell, LogOut, User, BarChart3, LayoutDashboard, Calendar } from 'lucide-react';

const Navbar = () => {
  const { user, logout, isAdmin } = useContext(AuthContext);
  const { notifications, unreadCount, markAsRead, markAllRead } = useContext(NotificationContext);
  const [showNotifications, setShowNotifications] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const activeClass = (path) => {
    return location.pathname === path
      ? 'text-blue-400 border-b-2 border-blue-500 pb-1'
      : 'text-slate-300 hover:text-white transition-colors';
  };

  return (
    <nav className="glass-panel sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-lg border-b border-slate-800">
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg premium-glow">
            QS
          </div>
          <span className="text-xl font-extrabold tracking-wider bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            QueueSync
          </span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link to="/dashboard" className={activeClass('/dashboard')}>
              <span className="flex items-center gap-1">
                <LayoutDashboard size={16} /> Customer Console
              </span>
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin" className={activeClass('/admin')}>
                  <span className="flex items-center gap-1">
                    <Calendar size={16} /> Admin Console
                  </span>
                </Link>
                <Link to="/analytics" className={activeClass('/analytics')}>
                  <span className="flex items-center gap-1">
                    <BarChart3 size={16} /> Analytics
                  </span>
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {user ? (
        <div className="flex items-center gap-4">
          {/* Notifications Trigger */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 hover:text-white transition-all relative"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Panel */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 glass-panel rounded-2xl shadow-2xl p-4 border border-slate-800 z-50 max-h-[400px] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                  <h3 className="font-bold text-sm text-slate-200">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-6">No notifications yet</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {notifications.map((notif) => (
                      <div
                        key={notif._id}
                        onClick={() => !notif.read && markAsRead(notif._id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          notif.read
                            ? 'bg-slate-900/40 border-slate-900 text-slate-400'
                            : 'bg-slate-800/60 border-slate-700/50 cursor-pointer text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            {notif.title}
                          </h4>
                          {!notif.read && (
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                          )}
                        </div>
                        <p className="text-xs mt-1 leading-relaxed">{notif.message}</p>
                        <span className="text-[9px] text-slate-500 block mt-2">
                          {new Date(notif.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile Info */}
          <div className="hidden sm:flex flex-col items-end text-xs">
            <span className="font-bold text-slate-200">{user.name}</span>
            <span className="text-[10px] text-slate-400 capitalize px-2 py-0.5 bg-slate-900 border border-slate-800 rounded-full mt-0.5">
              {user.role}
            </span>
          </div>

          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <User size={16} />
          </div>

          {/* Logout Action */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-red-950/40 hover:border-red-900/50 text-slate-400 hover:text-red-400 transition-all"
            title="Log Out"
          >
            <LogOut size={18} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <Link
            to="/login"
            className="px-4 py-2 rounded-xl text-slate-300 hover:text-white text-sm font-medium transition-all"
          >
            Log In
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold hover:opacity-90 shadow-lg premium-glow transition-all"
          >
            Sign Up
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
