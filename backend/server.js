const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');

// load env vars
dotenv.config();

// connect to db
connectDB();

const app = express();
const server = http.createServer(app);

// init sockets
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// store socket instance in app settings
app.set('io', io);

// express middlewares
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// socket connection listeners
io.on('connection', (socket) => {
  console.log(`Socket client connected: ${socket.id}`);

  // route messages to single user room
  socket.on('join_user_room', (userId) => {
    if (userId) {
      socket.join(`user:${userId}`);
      console.log(`Client ${socket.id} joined private room user:${userId}`);
    }
  });

  // join queue room for updates
  socket.on('join_queue_room', (queueId) => {
    if (queueId) {
      socket.join(`queue:${queueId}`);
      console.log(`Client ${socket.id} joined room queue:${queueId}`);
    }
  });

  // leave queue room
  socket.on('leave_queue_room', (queueId) => {
    if (queueId) {
      socket.leave(`queue:${queueId}`);
      console.log(`Client ${socket.id} left room queue:${queueId}`);
    }
  });

  // socket cleanup
  socket.on('disconnect', () => {
    console.log(`Socket client disconnected: ${socket.id}`);
  });
});

// load express routes
const authRoutes = require('./routes/authRoutes');
const queueRoutes = require('./routes/queueRoutes');
const entryRoutes = require('./routes/entryRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// mount api routes
app.use('/api/auth', authRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);

// health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'QueueSync server is running smoothly' });
});

// error handling
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`QueueSync Server running on port ${PORT}`);
});
