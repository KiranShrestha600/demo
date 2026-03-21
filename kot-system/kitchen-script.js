const socket = io();
let orders = [];
let audio = document.getElementById('notificationSound');
let newOrdersCount = 0;
let notificationPlaying = false;
let activeOrders = [];
let completedOrders = [];

// Play notification sound with visual feedback
function playNotification() {
    if (!notificationPlaying) {
        newOrdersCount++;
        updateNewOrdersCount();
        audio.currentTime = 0;
        audio.play().catch(e => console.log('Audio play failed:', e));
        document.getElementById('soundIndicator').style.background = '#ff4757';
        
        setTimeout(() => {
            document.getElementById('soundIndicator').style.background = '#2ecc71';
        }, 500);
        
        notificationPlaying = true;
        setTimeout(() => {
            notificationPlaying = false;
        }, 2000);
    }
}

// Update new orders counter
function updateNewOrdersCount() {
    document.getElementById('newOrdersCount').textContent = newOrdersCount;
}

// Reset counter when orders are acknowledged
function resetNewOrdersCount() {
    newOrdersCount = 0;
    updateNewOrdersCount();
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Kitchen connected to server');
});

socket.on('init', (data) => {
    orders = data.orders;
    displayOrders();
    displayChats(data.chats);
});

socket.on('newOrder', (order) => {
    orders.unshift(order);
    playNotification();
    displayOrders();
    
    // Visual alert
    showAlert(`New Order #${order.id} - Table ${order.tableNo}`);
});

socket.on('orderUpdate', (updatedOrder) => {
    const index = orders.findIndex(o => o.id === updatedOrder.id);
    if (index !== -1) {
        orders[index] = updatedOrder;
        displayOrders();
    }
});

// Update order status
// REPLACE the existing updateOrderStatus function with this:
function updateOrderStatus(orderId, status) {
    console.log('🔥 Kitchen updating order', orderId, 'to', status); // DEBUG
    
    fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: status }) // FORCE status
    })
    .then(res => res.json())
    .then(order => {
        console.log('✅ Kitchen update success:', order.status);
        if (status === 'preparing') showToast('🔥 Preparing started');
        if (status === 'ready') showToast('✅ Ready!');
        if (status === 'completed') showToast('✨ Completed - Counter will delete');
        displayOrders(); // Refresh display
    })
    .catch(err => console.error('❌ Update failed:', err));
}

// Display orders by status
// Updated displayOrders for kitchen
// FIXED: Clean displayOrders
function displayOrders(data) {
    if (data) {
        activeOrders = data.active || [];
        completedOrders = data.history || [];
    }
    
    // Pending
    document.getElementById('pendingOrders').innerHTML = 
        activeOrders.filter(o => o.status === 'pending').map(createOrderCard).join('');
    
    // Preparing
    document.getElementById('preparingOrders').innerHTML = 
        activeOrders.filter(o => o.status === 'preparing').map(createOrderCard).join('');
    
    // Ready  
    document.getElementById('readyOrders').innerHTML = 
        activeOrders.filter(o => o.status === 'ready').map(createOrderCard).join('');
    
    displayHistory(); // Always refresh history
}
function displayHistory() {
    // Remove duplicates by ID
    const uniqueHistory = completedOrders.filter((order, index, self) => 
        index === self.findIndex(o => o.id === order.id)
    ).slice(0, 20); // Last 20 orders
    
    const historyHtml = uniqueHistory.map(order => `
        <div class="kitchen-order-card completed history-item" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-id">#${order.id} ✓</div>
                <div class="order-status status-completed">COMPLETED</div>
            </div>
            <div class="customer-info">
                Table ${order.tableNo} | ${order.customerName || 'Walk-in'} 
                <span style="float: right; font-size: 12px; color: #7f8c8d;">
                    ${new Date(order.timestamp).toLocaleTimeString()}
                </span>
            </div>
            <div class="items-list">
                ${order.items.slice(0, 4).map(item => `
                    <div class="kitchen-item">${item.name} <strong>×${item.qty}</strong></div>
                `).join('')}
                ${order.items.length > 4 ? `<div style="font-size: 12px; color: #95a5a6;">... +${order.items.length-4} more</div>` : ''}
            </div>
        </div>
    `).join('');
    
    const historyContainer = document.getElementById('historySection');
    if (historyContainer) {
        historyContainer.innerHTML = `
            <div style="font-size: 14px; color: #7f8c8d; margin-bottom: 15px;">
                📜 ${uniqueHistory.length} Completed Orders Today
            </div>
            <div class="history-scroll" style="max-height: 350px; overflow-y: auto; padding-right: 10px;">
                ${historyHtml || '<div style="text-align: center; color: #bdc3c7; padding: 40px;">No completed orders yet</div>'}
            </div>
        `;
        historyContainer.scrollTop = 0; // Scroll to top
    }
}

// Socket listeners
socket.on('init', (data) => {
    fetch('/api/orders?userType=kitchen')
        .then(res => res.json())
        .then(displayOrders);
    displayChats(data.chats);
});

socket.on('newOrder', (order) => {
    activeOrders.unshift(order);
    playNotification();
    displayOrders();
});

socket.on('orderUpdate', (order) => {
    const index = activeOrders.findIndex(o => o.id === order.id);
    if (index !== -1) activeOrders[index] = order;
    displayOrders();
});

socket.on('orderCompleted', (data) => {
    fetch('/api/orders?userType=kitchen').then(res => res.json()).then(displayOrders);
    showToast('✅ Order completed & saved to history!');
});

socket.on('orderDeleted', (orderId) => {
    activeOrders = activeOrders.filter(o => o.id != orderId);
    displayOrders();
});

// Create order card HTML
function createOrderCard(order) {
    return `
        <div class="kitchen-order-card ${order.status}" data-order-id="${order.id}">
            <div class="order-header">
                <div class="order-id">#${order.id}</div>
                <div class="order-status status-${order.status}">${order.status.toUpperCase()}</div>
            </div>
            <div class="customer-info">
                Table ${order.tableNo} | ${order.customerName || 'Walk-in'} | ${order.persons} persons
            </div>
            <div class="items-list">
                ${order.items.map(item => `
                    <div class="kitchen-item">
                        <span style="font-weight: 600;">${item.name}</span>
                        <span style="font-size: 1.2em; color: #e74c3c;">×${item.qty}</span>
                    </div>
                `).join('')}
            </div>
            <!-- In kitchen-script.js, UPDATE createOrderCard function buttons section: -->
            <div class="status-buttons">
                 ${order.status === 'pending' ? 
                `<button class="btn btn-preparing" onclick="updateOrderStatus(${order.id}, 'preparing')">
                🔥 Start Preparing
                </button>` : ''
                 }
                ${order.status === 'pending' || order.status === 'preparing' ? 
               `<button class="btn btn-ready" onclick="updateOrderStatus(${order.id}, 'ready')">
              ✅ Mark Ready
                </button>` : ''
                 }
                ${order.status === 'ready' ? 
                `<button class="btn" style="background: linear-gradient(45deg, #27ae60, #2ecc71); color: white; font-size: 16px;" 
                onclick="updateOrderStatus(${order.id}, 'completed')">
             ✨ ORDER COMPLETED - Send to Counter
                </button>` : ''
                }
            </div>
            <div class="timestamp">${new Date(order.timestamp).toLocaleString()}</div>
        </div>
    `;
}

// Visual notifications
function showAlert(message) {
    const alert = document.createElement('div');
    alert.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #e74c3c, #c0392b);
        color: white;
        padding: 20px 30px;
        border-radius: 15px;
        font-weight: bold;
        font-size: 1.2em;
        box-shadow: 0 20px 40px rgba(231,76,60,0.4);
        z-index: 10000;
        animation: slideInRight 0.5s ease-out;
    `;
    alert.textContent = message;
    document.body.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 4000);
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(45deg, #27ae60, #2ecc71);
        color: white;
        padding: 15px 30px;
        border-radius: 30px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 10px 30px rgba(39,174,96,0.4);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutUp 0.5s ease-out forwards';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// Chat functionality
function sendKitchenChat() {
    const message = document.getElementById('kitchenChatMessage').value.trim();
    if (message) {
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'Kitchen',
                message
            })
        });
        document.getElementById('kitchenChatMessage').value = '';
    }
}

socket.on('newChat', (chat) => {
    displayKitchenChats([chat, ...getChatsFromStorage()]);
});

function getChatsFromStorage() {
    return JSON.parse(localStorage.getItem('kitchenChats') || '[]');
}

function displayKitchenChats(chats) {
    localStorage.setItem('kitchenChats', JSON.stringify(chats));
    const container = document.getElementById('kitchenChat');
    container.innerHTML = chats.map(chat => `
        <div class="chat-message">
            <strong style="color: ${chat.from === 'Kitchen' ? '#27ae60' : '#e74c3c'}">${chat.from}:</strong> 
            ${chat.message}<br>
            <small>${new Date(chat.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        sendKitchenChat();
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%) translateY(-50%); opacity: 0; }
        to { transform: translateX(0) translateY(0); opacity: 1; }
    }
    @keyframes slideOutUp {
        to { transform: translateX(-50%) translateY(-100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Auto-refresh orders every 10 seconds (backup)
setInterval(() => {
    fetch('/api/orders')
        .then(res => res.json())
        .then(data => {
            orders = data;
            displayOrders();
        });
}, 10000);

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Preload notification sound
    audio.load();
});
// ADD THIS FUNCTION - Clear History
function clearHistory() {
    if (confirm('🗑️ Clear ALL order history?\nThis cannot be undone!')) {
        fetch('/api/clear-history', { method: 'POST' })
            .then(() => {
                completedOrders = [];
                displayHistory();
                showToast('📜 History cleared successfully!');
                document.getElementById('clearHistoryBtn').style.background = '#27ae60';
                setTimeout(() => {
                    document.getElementById('clearHistoryBtn').style.background = '';
                }, 1000);
            })
            .catch(err => {
                alert('Clear failed: ' + err);
            });
}
}
// ADD THIS SOCKET LISTENER
socket.on('historyCleared', () => {
    completedOrders = [];
    displayHistory();
    showToast('History cleared by kitchen!');
});