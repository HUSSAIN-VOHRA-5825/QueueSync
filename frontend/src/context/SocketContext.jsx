import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const { user } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    let socketInstance = null;

    if (user) {
      // startup socket connection
      socketInstance = io('http://localhost:5000', {
        transports: ['websocket'],
      });

      // listen on personal room
      socketInstance.emit('join_user_room', user.id);

      socketInstance.on('connect', () => {
        console.log('Socket connected to backend server');
      });

      socketInstance.on('disconnect', () => {
        console.log('Socket disconnected from server');
      });

      setSocket(socketInstance);
    } else {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    }

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
    };
  }, [user]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
};
