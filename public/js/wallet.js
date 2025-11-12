// Umumiy o'zgaruvchilar
let currentUser = null;
const API_BASE = '/api';

// Sahifa yuklanganda
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
    loadUserData();
    setupEventListeners();
    if (window.location.pathname.includes('admin.html')) {
        loadAdminData();
    } else if (window.location.pathname.includes('history.html')) {
        loadTransactions();
    } else {
        loadRecentTransactions();
    }
});

// Avtorizatsiyani tekshirish
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/user`);
        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('username-display').textContent = currentUser.username;
            if (currentUser.isAdmin) {
                document.getElementById('admin-link').classList.remove('hidden');
            }
        } else {
            window.location.href = 'register-login.html'; // Login sahifasi yarating yoki redirect
        }
    } catch (error) {
        console.error('Auth xatosi:', error);
    }
}

// Foydalanuvchi ma'lumotlarini yuklash
async function loadUserData() {
    if (!currentUser) return;
    document.getElementById('balance-display').textContent = currentUser.balance.toFixed(2);
    document.getElementById('wallet-id-display').textContent = currentUser.walletId;
}

// Event listener'lar
function setupEventListeners() {
    // Logout
    document.getElementById('logout-btn')?.addEventListener('click', async () => {
        await fetch(`${API_BASE}/logout`, { method: 'POST' });
        window.location.href = 'login.html';
    });

    // Deposit
    document.getElementById('deposit-btn')?.addEventListener('click', () => openModal('deposit'));

    // Withdraw
    document.getElementById('withdraw-btn')?.addEventListener('click', () => openModal('withdraw'));

    // Transfer
    document.getElementById('transfer-btn')?.addEventListener('click', () => openModal('transfer'));

    // Modal tugmalari
    document.getElementById('cancel-transaction')?.addEventListener('click', closeModal);
    document.getElementById('confirm-transaction')?.addEventListener('click', confirmTransaction);

    // Admin modal
    if (document.getElementById('close-admin-modal')) {
        document.getElementById('close-admin-modal').addEventListener('click', closeAdminModal);
        document.getElementById('approve-btn').addEventListener('click', approveDeposit);
        document.getElementById('reject-btn').addEventListener('click', rejectDeposit);
    }
}

// Modal ochish
function openModal(type) {
    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('modal-title');
    const icon = document.getElementById('modal-icon');
    const body = document.getElementById('modal-body');
    let content = '';

    if (type === 'deposit') {
        title.textContent = 'Hisobni to\'ldirish so\'rovi';
        icon.className = 'fas fa-plus-circle text-green-600';
        content = `
            <div>
                <label class="block text-sm font-medium text-gray-700">Summa</label>
                <div class="mt-1 relative rounded-md shadow-sm">
                    <input type="number" id="amount" class="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md p-2 border" placeholder="0.00" step="0.01">
                    <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-gray-500 sm:text-sm">USD</span>
                    </div>
                </div>
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700">Screenshot yuklash (Admin kartasiga to\'lovdan keyin)</label>
                <input type="file" id="screenshot" accept="image/*" class="mt-1 block w-full">
            </div>
            <div class="mt-4 p-3 bg-blue-50 rounded">
                <p class="text-sm text-blue-800"><strong>Admin Kartasi Ma\'lumotlari:</strong> 8600 1234 5678 9012 (Click)</p>
                <p class="text-sm text-blue-800">Yuqoridagi kartaga to\'lov qiling va screenshot yuklang.</p>
            </div>
        `;
    } else if (type === 'withdraw') {
        title.textContent = 'Pul yechish';
        icon.className = 'fas fa-minus-circle text-red-600';
        content = `
            <div>
                <label class="block text-sm font-medium text-gray-700">Summa</label>
                <div class="mt-1 relative rounded-md shadow-sm">
                    <input type="number" id="amount" class="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md p-2 border" placeholder="0.00" step="0.01">
                    <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-gray-500 sm:text-sm">USD</span>
                    </div>
                </div>
            </div>
        `;
    } else if (type === 'transfer') {
        title.textContent = 'Pul o\'tkazish';
        icon.className = 'fas fa-exchange-alt text-purple-600';
        content = `
            <div>
                <label class="block text-sm font-medium text-gray-700">Qabul qiluvchi Wallet ID</label>
                <input type="text" id="to-wallet" class="focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border mt-1" placeholder="HAQ...">
            </div>
            <div class="mt-4">
                <label class="block text-sm font-medium text-gray-700">Summa</label>
                <div class="mt-1 relative rounded-md shadow-sm">
                    <input type="number" id="amount" class="focus:ring-blue-500 focus:border-blue-500 block w-full pr-12 sm:text-sm border-gray-300 rounded-md p-2 border" placeholder="0.00" step="0.01">
                    <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span class="text-gray-500 sm:text-sm">USD</span>
                    </div>
                </div>
            </div>
        `;
    }

    body.innerHTML = content;
    modal.classList.remove('hidden');
    window.currentModalType = type;
}

// Modal yopish
function closeModal() {
    document.getElementById('transaction-modal').classList.add('hidden');
}

// Tranzaksiyani tasdiqlash
async function confirmTransaction() {
    const type = window.currentModalType;
    let payload = {};

    if (type === 'deposit') {
        const amount = document.getElementById('amount').value;
        const screenshotFile = document.getElementById('screenshot').files[0];
        if (!amount || !screenshotFile) {
            alert('Summa va screenshot majburiy!');
            return;
        }
        // Screenshot base64 ga o'girish
        const reader = new FileReader();
        reader.onload = async (e) => {
            payload = { amount, screenshot: e.target.result };
            await sendDepositRequest(payload);
        };
        reader.readAsDataURL(screenshotFile);
    } else if (type === 'withdraw' || type === 'transfer') {
        const amount = document.getElementById('amount').value;
        if (!amount || parseFloat(amount) <= 0) {
            alert('To\'g\'ri summa kiriting!');
            return;
        }
        if (type === 'transfer') {
            payload.toWallet = document.getElementById('to-wallet').value;
            if (!payload.toWallet) {
                alert('Wallet ID kiriting!');
                return;
            }
        }
        payload.amount = amount;
        payload.type = type;
        await performTransaction(payload);
    }

    closeModal();
    loadUserData();
    loadRecentTransactions();
}

// Deposit so'rov yuborish
async function sendDepositRequest(payload) {
    try {
        const response = await fetch(`${API_BASE}/deposit/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            alert(data.message);
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Xato yuz berdi!');
    }
}

// Umumiy tranzaksiya
async function performTransaction(payload) {
    let endpoint = type === 'withdraw' ? `${API_BASE}/balance/update` : `${API_BASE}/transfer`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.success) {
            alert(data.message);
            currentUser.balance = data.newBalance;
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Xato yuz berdi!');
    }
}

// So'nggi tranzaksiyalarni yuklash
async function loadRecentTransactions() {
    try {
        const response = await fetch(`${API_BASE}/transactions`);
        const transactions = await response.json();
        const container = document.getElementById('recent-transactions');
        if (transactions.length === 0) return;

        container.innerHTML = transactions.slice(0, 5).map(tx => `
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                    <p class="font-medium">${tx.description}</p>
                    <p class="text-sm text-gray-500">${new Date(tx.createdAt).toLocaleString('uz-UZ')}</p>
                </div>
                <div class="text-right">
                    <p class="${tx.type === 'transfer' ? 'text-purple-600' : tx.type === 'deposit' ? 'text-green-600' : 'text-red-600'} font-bold">±${tx.amount.toFixed(2)} USD</p>
                    <span class="text-xs text-gray-500">${tx.status}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Tranzaksiyalar yuklash xatosi:', error);
    }
}

// Tarixni yuklash (history.html)
async function loadTransactions() {
    try {
        const response = await fetch(`${API_BASE}/transactions`);
        const transactions = await response.json();
        const tbody = document.getElementById('transactions-tbody');
        tbody.innerHTML = transactions.map(tx => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${tx.type}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${tx.amount.toFixed(2)} USD</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tx.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : tx.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${tx.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${new Date(tx.createdAt).toLocaleString('uz-UZ')}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${tx.description}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Tarix yuklash xatosi:', error);
    }
}

// Admin ma'lumotlarini yuklash
async function loadAdminData() {
    // Foydalanuvchilar
    try {
        const response = await fetch(`${API_BASE}/admin/users`);
        const users = await response.json();
        const tbody = document.getElementById('users-tbody');
        tbody.innerHTML = users.map(user => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${user.username}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${user.walletId}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${user.balance.toFixed(2)} USD</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="editUser('${user._id}')" class="text-indigo-600 hover:text-indigo-900 mr-3">Tahrirlash</button>
                    <button onclick="deleteUser('${user._id}')" class="text-red-600 hover:text-red-900">O'chirish</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Foydalanuvchilar yuklash xatosi:', error);
    }

    // Pending deposits
    try {
        const response = await fetch(`${API_BASE}/admin/pending-deposits`);
        const deposits = await response.json();
        const container = document.getElementById('pending-deposits');
        const noPending = document.getElementById('no-pending');
        if (deposits.length === 0) {
            noPending.style.display = 'block';
            return;
        }
        noPending.style.display = 'none';
        container.innerHTML = deposits.map(deposit => `
            <div class="flex justify-between items-center p-4 bg-yellow-50 border border-yellow-200 rounded">
                <div>
                    <p class="font-medium">Foydalanuvchi: ${deposit.userId.username} (${deposit.userId.walletId})</p>
                    <p class="text-sm text-gray-600">Miqdor: ${deposit.amount.toFixed(2)} USD</p>
                    <p class="text-sm text-gray-600">Vaqt: ${new Date(deposit.createdAt).toLocaleString('uz-UZ')}</p>
                </div>
                <button onclick="openAdminModal('${deposit._id}')" class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                    Tafsilotlarni ko'rish
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Pending deposits yuklash xatosi:', error);
    }
}

// Admin modal ochish
let currentDepositId = null;
async function openAdminModal(id) {
    currentDepositId = id;
    try {
        const response = await fetch(`${API_BASE}/admin/transactions`); // Bitta deposit uchun, lekin umumiy dan filter
        const transactions = await response.json();
        const deposit = transactions.find(tx => tx._id === id);
        if (!deposit) return;

        const modal = document.getElementById('admin-modal');
        const title = document.getElementById('admin-modal-title');
        const icon = document.getElementById('admin-modal-icon');
        const body = document.getElementById('admin-modal-body');

        title.textContent = 'Deposit So\'rov Tafsilotlari';
        icon.className = 'fas fa-image text-yellow-600';
        body.innerHTML = `
            <div class="space-y-4">
                <p><strong>Foydalanuvchi:</strong> ${deposit.userId.username} (${deposit.userId.walletId})</p>
                <p><strong>Miqdor:</strong> ${deposit.amount.toFixed(2)} USD</p>
                <p><strong>Karta ma'lumotlari:</strong> ${deposit.adminCardInfo}</p>
                <p><strong>Vaqt:</strong> ${new Date(deposit.createdAt).toLocaleString('uz-UZ')}</p>
                ${deposit.screenshot ? `<img src="${deposit.screenshot}" alt="Screenshot" class="max-w-full h-48 object-cover rounded">` : '<p>Screenshot mavjud emas</p>'}
            </div>
        `;
        modal.classList.remove('hidden');
    } catch (error) {
        console.error('Admin modal xatosi:', error);
    }
}

// Admin modal yopish
function closeAdminModal() {
    document.getElementById('admin-modal').classList.add('hidden');
}

// Approve
async function approveDeposit() {
    try {
        const response = await fetch(`${API_BASE}/admin/deposit/${currentDepositId}/approve`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            alert(data.message);
            closeAdminModal();
            loadAdminData();
        }
    } catch (error) {
        alert('Xato!');
    }
}

// Reject
async function rejectDeposit() {
    try {
        const response = await fetch(`${API_BASE}/admin/deposit/${currentDepositId}/reject`, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            alert(data.message);
            closeAdminModal();
            loadAdminData();
        }
    } catch (error) {
        alert('Xato!');
    }
}

// Admin uchun edit/delete (sodda alert, to'liq qilish mumkin)
function editUser(id) {
    alert(`Tahrirlash: ${id} - Modal qo'shing`);
}

function deleteUser(id) {
    if (confirm('O\'chirishni xohlaysizmi?')) {
        fetch(`${API_BASE}/admin/users/${id}`, { method: 'DELETE' })
            .then(() => loadAdminData());
    }
}