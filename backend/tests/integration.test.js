const { exec } = require('child_process');
const http = require('http');

const BASE_URL = 'http://localhost:5000/api';

// Helper to make API requests
const request = async (url, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse response: ${text}`);
  }
};

const runTests = async () => {
  console.log('🚀 Starting QueueSync integration tests...');

  try {
    const timestamp = Date.now();
    const adminEmail = `admin_${timestamp}@test.com`;
    const userEmail = `user_${timestamp}@test.com`;

    // 1. Register Admin
    console.log('\n📝 Testing Admin Registration...');
    const adminSignupRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Admin',
        email: adminEmail,
        password: 'password123',
        role: 'admin',
      },
    });
    if (!adminSignupRes.success || !adminSignupRes.token) {
      throw new Error(`Admin registration failed: ${JSON.stringify(adminSignupRes)}`);
    }
    const adminToken = adminSignupRes.token;
    console.log('✅ Admin Registered successfully!');

    // 2. Register Customer User
    console.log('\n📝 Testing Customer Registration...');
    const userSignupRes = await request('/auth/register', {
      method: 'POST',
      body: {
        name: 'Test Customer',
        email: userEmail,
        password: 'password123',
        role: 'user',
      },
    });
    if (!userSignupRes.success || !userSignupRes.token) {
      throw new Error(`Customer registration failed: ${JSON.stringify(userSignupRes)}`);
    }
    const userToken = userSignupRes.token;
    console.log('✅ Customer Registered successfully!');

    // 3. Login Test
    console.log('\n🔑 Testing Login...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: {
        email: userEmail,
        password: 'password123',
      },
    });
    if (!loginRes.success || loginRes.user.email !== userEmail) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes)}`);
    }
    console.log('✅ User Login successful!');

    // 4. Create Queue (Admin)
    console.log('\n➕ Testing Queue Creation (Admin only)...');
    const queueCode = `TST-${timestamp.toString().slice(-4)}`;
    const createQueueRes = await request('/queues', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Integration Test Queue',
        code: queueCode,
        description: 'Test queue for verification',
        capacityLimit: 10,
        defaultServiceTime: 4,
      },
    });
    if (!createQueueRes.success || createQueueRes.data.code !== queueCode) {
      throw new Error(`Queue creation failed: ${JSON.stringify(createQueueRes)}`);
    }
    const queueId = createQueueRes.data._id;
    console.log(`✅ Queue "${createQueueRes.data.name}" created with code ${queueCode}!`);

    // 5. Fetch Queues List (Customer)
    console.log('\n🔍 Testing Queue Fetching and Searching (Customer)...');
    const getQueuesRes = await request(`/queues?search=${queueCode}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!getQueuesRes.success || getQueuesRes.data.length !== 1) {
      throw new Error(`Queue search failed: ${JSON.stringify(getQueuesRes)}`);
    }
    console.log('✅ Queue search query works properly!');

    // 6. Join Queue (Customer)
    console.log('\n🚶 Testing Customer Joining Queue...');
    const joinRes = await request(`/entries/join/${queueId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!joinRes.success || joinRes.data.entry.tokenNumber !== 1) {
      throw new Error(`Queue join failed: ${JSON.stringify(joinRes)}`);
    }
    console.log(`✅ Joined queue! Assigned Token #${joinRes.data.entry.tokenNumber}. Estimated wait: ${joinRes.data.estimatedWaitTime} min.`);

    // 7. Get Active User Entry (Customer)
    console.log('\n📊 Testing Get Active Customer Entry...');
    const activeRes = await request('/entries/active', {
      method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    if (!activeRes.success || activeRes.data.length === 0 || activeRes.data[0].queueId._id !== queueId) {
      throw new Error(`Active entries fetch failed: ${JSON.stringify(activeRes)}`);
    }
    console.log('✅ Active queue entry retrieved successfully!');

    // 8. Serve Next (Admin calls Customer)
    console.log('\n🔔 Testing Serve Next Customer (Admin call)...');
    const serveRes = await request(`/entries/serve-next/${queueId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!serveRes.success || serveRes.data.tokenNumber !== 1 || serveRes.data.status !== 'serving') {
      throw new Error(`Serve next call failed: ${JSON.stringify(serveRes)}`);
    }
    console.log(`✅ Server called Token #${serveRes.data.tokenNumber} to counter! Status changed to 'serving'.`);

    // 9. Complete Service (Admin)
    console.log('\n🏁 Testing Complete Service (Admin)...');
    const completeRes = await request(`/entries/complete/${queueId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (!completeRes.success || completeRes.data.status !== 'completed' || !completeRes.data.serviceEndedAt) {
      throw new Error(`Complete service failed: ${JSON.stringify(completeRes)}`);
    }
    console.log('✅ Service successfully marked as completed!');

    console.log('\n✨ ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ✨');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ INTEGRATION TEST FAILED:');
    console.error(error.message);
    process.exit(1);
  }
};

runTests();
