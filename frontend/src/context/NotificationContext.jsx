import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';
import { SocketContext } from './SocketContext';

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const { token, user } = useContext(AuthContext);
  const socket = useContext(SocketContext);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);

  const API_URL = 'http://localhost:5000/api/notifications';

  // load user notifications
  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_URL, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications(data.data);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
    } else {
      setNotifications([]);
    }
  }, [token]);

  // show alert toast on screen
  const addToast = (title, message, type = 'status_update') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);

    // auto dismiss toast
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // listen to socket updates
  useEffect(() => {
    if (!socket) return;

    socket.on('notification_received', (notification) => {
      setNotifications((prev) => [notification, ...prev]);
      addToast(notification.title, notification.message, notification.type);
    });

    // notify if called to counter
    socket.on('user_serving_alert', (data) => {
      addToast(
        '👉 IT IS YOUR TURN!',
        data.message,
        'serving_alert'
      );
      
      // chime speaker alert sound
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.4);
      } catch (e) {
        console.log('Audio alert blocked.');
      }
    });

    return () => {
      socket.off('notification_received');
      socket.off('user_serving_alert');
    };
  }, [socket]);

  // mark notification as read
  const markAsRead = async (id) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/${id}/read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  // mark all notifications as read
  const markAllRead = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/read-all`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        toasts,
        markAsRead,
        markAllRead,
        addToast,
        removeToast,
      }}
    >
      {children}

      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={`cursor-pointer p-4 rounded-xl shadow-2xl glass-panel animate-fade-in border-l-4 transition-all duration-300 hover:scale-[1.02] ${
              toast.type === 'serving_alert'
                ? 'border-l-purple-500 premium-glow-purple bg-purple-950/40'
                : 'border-l-blue-500 premium-glow bg-slate-900/60'
            }`}
          >
            <div className="flex justify-between items-start">
              <h4 className="font-bold text-sm tracking-wide text-slate-100 uppercase">
                {toast.title}
              </h4>
              <span className="text-[10px] text-slate-400">✕</span>
            </div>
            <p className="text-xs text-slate-300 mt-1">{toast.message}</p>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
