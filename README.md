# QueueSync

QueueSync is a full-stack, real-time queue management system designed to eliminate physical waiting lines. Customers can join service queues remotely, track their queue position, and view live wait time estimations. Businesses can create, pause, or resume queues, call the next customer, and monitor active traffic metrics.

## Key Features
* ⏳ **Remote Joins**: Join queues remotely using unique counter codes.
* ⏱️ **Wait Estimation**: Dynamic algorithm calculates waiting times based on rolling averages of completed service durations.
* ⚡ **Real-Time Sockets**: Instant token updates and counter paging (with browser pop-ups and chime alerts).
* 💼 **Admin Counter Console**: Controls to "Serve Next", skip, or complete tickets.
* 📊 **Analytics Dashboard**: Aggregated queue volumes and peak traffic times.
* 🔒 **Secure Auth**: Role-based access control secured with JWT.

## Tech Stack
* **Frontend**: React, React Router, Tailwind CSS, Chart.js, Socket.io-client
* **Backend**: Node.js, Express, Socket.io, Mongoose (MongoDB)

## Local Setup

### Prerequisites
* Node.js (v20+)
* MongoDB running locally (`mongodb://localhost:27017`)

### 1. Clone & Run Backend
```bash
cd backend
npm install
npm start
```

### 2. Run Frontend
```bash
cd ../frontend
npm install
npm run dev
```
