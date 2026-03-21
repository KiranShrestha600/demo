const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// In-memory storage (use database in production)
let orders = [];
let chats = [];
let activeOrders = [];  // Pending, preparing, ready
let completedOrders = []; // History - Never deleted from kitchen

// Serve frontend files
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

app.get('/kitchen', (req, res) => {
  res.sendFile(__dirname + '/kitchen.html');
});

// API Routes
app.get('/api/orders', (req, res) => {
  const userType = req.query.userType;
  console.log('📋 GET orders for:', userType || 'counter');
  
  if (userType === 'kitchen') {
    res.json({ active: activeOrders, history: completedOrders });
  } else {
    // Counter: Only active orders (pending/preparing/ready/completed)
    const counterOrders = [...activeOrders];
    res.json(counterOrders);
  }
});

app.post('/api/orders', (req, res) => {
  const order = {
    id: Date.now(),
    ...req.body,
    status: 'pending',
    timestamp: new Date(),
    items: req.body.items || []
  };
  activeOrders.unshift(order);
  io.emit('newOrder', order);
  res.json(order);
});
// ADD THIS NEW ROUTE - Counter can delete completed orders
// REPLACE the DELETE route with this FIXED version:
app.delete('/api/orders/:id', (req, res) => {
  const orderId = parseInt(req.params.id);
  console.log('🗑️ Delete request for ID:', orderId);
  
  // Search ACTIVE orders first
  let index = activeOrders.findIndex(o => o.id == orderId);
  if (index !== -1) {
    console.log('✅ Deleting from active:', orderId);
    activeOrders.splice(index, 1);
    io.emit('orderDeleted', orderId);
    return res.json({ success: true });
  }
  
  // Search HISTORY (allow counter to delete from history too)
  index = completedOrders.findIndex(o => o.id == orderId);
  if (index !== -1) {
    console.log('✅ Deleting from history:', orderId);
    completedOrders.splice(index, 1);
    io.emit('orderDeleted', orderId);
    return res.json({ success: true });
  }
  
  console.log('❌ Order not found:', orderId);
  res.status(404).json({ error: 'Order not found in active or history' });
});
app.put('/api/orders/:id', (req, res) => {
  const index = activeOrders.findIndex(o => o.id == req.params.id);
  if (index !== -1) {
    const order = activeOrders[index];
    const newStatus = req.body.status;
    
    // Prevent duplicate completed
    if (newStatus === 'completed' && order.status !== 'completed') {
      // Move to history ONCE only
      completedOrders.unshift(activeOrders.splice(index, 1)[0]);
      completedOrders = [...new Set(completedOrders.map(o => JSON.stringify(o)))].map(str => JSON.parse(str)); // Remove duplicates
      io.emit('orderCompleted', { id: order.id, history: completedOrders });
      console.log('✅ Moved to history:', order.id);
    } else if (newStatus !== 'completed') {
      order.status = newStatus;
      io.emit('orderUpdate', order);
    }
    res.json(order);
  } else {
    res.status(404).json({ error: 'Order not found' });
  }
});

app.post('/api/chat', (req, res) => {
  const message = {
    id: Date.now(),
    from: req.body.from,
    message: req.body.message,
    timestamp: new Date()
  };
  chats.push(message);
  io.emit('newChat', message);
  res.json(message);
});

app.get('/api/orders', (req, res) => {
  console.log('📋 Current orders:', orders.length, 'statuses:', orders.map(o=>o.status));
  res.json(orders);
});

// Socket.IO Real-time Communication
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Send current orders and chats to new connection
  socket.emit('init', { orders, chats });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// ADD THIS NEW ROUTE - Clear history (Kitchen only)
app.post('/api/clear-history', (req, res) => {
  console.log('🗑️ Clearing history...');
  completedOrders = [];
  io.emit('historyCleared');
  res.json({ success: true });
});