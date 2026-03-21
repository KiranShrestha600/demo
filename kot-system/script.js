 const socket = io();
let currentOrderItems = [];

// Connection status
socket.on('connect', () => {
    document.getElementById('connectionStatus').textContent = 'Connected';
    document.getElementById('connectionStatus').className = 'connected';
});

socket.on('disconnect', () => {
    document.getElementById('connectionStatus').textContent = 'Disconnected';
    document.getElementById('connectionStatus').className = 'disconnected';
});

// Order management
function addItem() {
    const name = document.getElementById('itemName').value.trim();
    const qty = parseInt(document.getElementById('itemQty').value) || 1;
    
    if (name && qty > 0) {
        currentOrderItems.push({ name, qty });
        document.getElementById('itemName').value = '';
        document.getElementById('itemQty').value = '';
        displayOrderItems();
    }
}

function displayOrderItems() {
    const container = document.getElementById('orderItems');
    container.innerHTML = currentOrderItems.map(item => 
        `<div class="order-item">
            <span>${item.name} × ${item.qty}</span>
            <button onclick="removeItem(${currentOrderItems.indexOf(item)})">❌</button>
        </div>`
    ).join('');
}

function removeItem(index) {
    currentOrderItems.splice(index, 1);
    displayOrderItems();
}

function sendOrder() {
    const tableNo = document.getElementById('tableNo').value.trim();
    const customerName = document.getElementById('customerName').value.trim();
    const persons = parseInt(document.getElementById('persons').value) || 1;

    if (!tableNo || currentOrderItems.length === 0) {
        alert('Please fill table number and add at least one item');
        return;
    }

    fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            tableNo,
            customerName,
            persons,
            items: currentOrderItems
        })
    }).then(res => res.json())
    .then(order => {
        // Reset form
        document.getElementById('tableNo').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('persons').value = '';
        currentOrderItems = [];
        displayOrderItems();
        alert('Order sent to kitchen! 🎉');
    });
}

// Replace fetch calls in script.js
socket.on('init', () => {
    fetch('/api/orders?userType=counter')
        .then(res => res.json())
        .then(displayOrders);
});

socket.on('newOrder', (order) => {
    displayOrders([order, ...getOrdersFromStorage()]);
});

socket.on('orderUpdate', (order) => {
    const orders = getOrdersFromStorage();
    const index = orders.findIndex(o => o.id === order.id);
    if (index !== -1) {
        orders[index] = order;
        displayOrders(orders);
    }
});

function getOrdersFromStorage() {
    // In production, fetch from API
    return JSON.parse(localStorage.getItem('orders') || '[]');
}

function displayOrders(orders) {
    console.log('🎯 All orders:', orders.map(o => `ID:${o.id} Status:"${o.status}"`));
    
    localStorage.setItem('orders', JSON.stringify(orders));
    const container = document.getElementById('ordersList');
    
    const html = orders.map(order => {
        const status = order.status || 'pending';
        const isCompleted = status === 'completed' || status === 'ready'; // SHOW DELETE FOR BOTH!
        console.log(`🗑️ Order #${order.id}: status="${status}" → deleteVisible=${isCompleted}`);
        
        return `
            <div class="order-card ${status}">
                <div class="order-header">
                    <h3>#${order.id} - Table ${order.tableNo}</h3>
                    <span class="status-badge status-${status}">${status.toUpperCase()}</span>
                </div>
                <p><strong>${order.customerName || 'Walk-in'}</strong> | ${order.persons} persons</p>
                <div style="margin: 15px 0; max-height: 150px; overflow-y: auto; padding: 10px; background: #f8f9fa; border-radius: 10px;">
                    ${order.items.map(item => 
                        `<div style="padding: 6px; margin: 4px 0; background: white; border-radius: 6px; border-left: 3px solid #3498db;">
                            <strong>${item.name}</strong> × ${item.qty}
                        </div>`
                    ).join('')}
                </div>
                <div style="padding: 10px; background: #e8f5e8; border-radius: 8px; margin-top: 10px; font-size: 14px;">
                    📅 ${new Date(order.timestamp).toLocaleString()}
                </div>
                
                <!-- DELETE BUTTON - Shows for completed OR ready -->
                ${isCompleted ? `
                    <div style="margin-top: 20px; padding: 20px; background: linear-gradient(135deg, #ff6b6b, #ee5a52); 
                                border: 3px solid #ff5252; border-radius: 15px; text-align: center; box-shadow: 0 8px 25px rgba(255,107,107,0.4);">
                        <div style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;">
                            ✅ ${status.toUpperCase()} - READY FOR DELIVERY
                        </div>
                        <button onclick="deleteOrder(${order.id})" 
                                style="width: 100%; padding: 15px 25px; background: white; color: #ee5a52; 
                                       border: 2px solid #ff5252; border-radius: 12px; font-weight: bold; 
                                       font-size: 18px; cursor: pointer; transition: all 0.3s;">
                            🗑️ DELETE COMPLETED ORDER
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}
// Chat functionality
function sendChat() {
    const message = document.getElementById('chatMessage').value.trim();
    if (message) {
        fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                from: 'Counter',
                message
            })
        });
        document.getElementById('chatMessage').value = '';
    }
}

socket.on('newChat', (chat) => {
    displayChats([chat, ...getChatsFromStorage()]);
});

function getChatsFromStorage() {
    return JSON.parse(localStorage.getItem('chats') || '[]');
}

function displayChats(chats) {
    localStorage.setItem('chats', JSON.stringify(chats));
    const container = document.getElementById('chatMessages');
    container.innerHTML = chats.map(chat => `
        <div class="chat-message">
            <strong>${chat.from}:</strong> ${chat.message}<br>
            <small>${new Date(chat.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
    
    container.scrollTop = container.scrollHeight;
}

// Enter key support
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        if (document.activeElement.id === 'chatMessage') {
            sendChat();
        }
    }
});
// DELETE ORDER FUNCTION
function deleteOrder(orderId) {
    console.log('🗑️ Counter deleting order:', orderId);
    
    if (confirm(`Delete order #${orderId}?\nThis removes it from ALL devices permanently.`)) {
        fetch(`/api/orders/${orderId}`, { 
            method: 'DELETE' 
        })
        .then(res => res.json())
        .then(data => {
            console.log('📊 Delete response:', data);
            if (data.success) {
                showToast('✅ Order deleted from all devices!');
                // Refresh orders
                fetch('/api/orders?userType=counter')
                    .then(res => res.json())
                    .then(displayOrders);
            } else {
                showToast('❌ Delete failed: ' + data.error);
            }
        })
        .catch(err => {
            console.error('💥 Network error:', err);
            showToast('❌ Network error - try again');
        });
    }
}

// SOCKET LISTENER FOR DELETED ORDERS
socket.on('orderDeleted', (orderId) => {
    const orders = getOrdersFromStorage().filter(o => o.id != orderId);
    displayOrders(orders);
});
// ADD this socket listener
socket.on('orderDeleted', (orderId) => {
    console.log('🔄 Order deleted by another device:', orderId);
    fetch('/api/orders?userType=counter')
        .then(res => res.json())
        .then(displayOrders);
});
// TOAST NOTIFICATION FUNCTION
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
        background: #27ae60; color: white; padding: 15px 30px;
        border-radius: 25px; font-weight: bold; z-index: 10000;
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}