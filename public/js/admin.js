// Admin.js - Admin paneli

document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    const usersTab = document.getElementById('users-tab');
    const transactionsTab = document.getElementById('transactions-tab');
    const usersPanel = document.getElementById('users-panel');
    const transactionsPanel = document.getElementById('transactions-panel');
    const usersContainer = document.getElementById('users-container');
    const adminTransactionsContainer = document.getElementById('admin-transactions-container');
    
    const editUserModal = document.getElementById('edit-user-modal');
    const editUsername = document.getElementById('edit-username');
    const editBalance = document.getElementById('edit-balance');
    const saveUserBtn = document.getElementById('save-user-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    let currentEditingUserId = null;
    
    // Sahifa yuklanganda foydalanuvchi ma'lumotlarini yuklash
    loadUserData();
    loadUsers();
    
    // Chiqish
    logoutBtn.addEventListener('click', async function() {
        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.location.href = 'register-login.html';
            }
        } catch (error) {
            console.error('Chiqish xatosi:', error);
        }
    });
    
    // Tab o'zgartirish
    usersTab.addEventListener('click', function() {
        usersTab.classList.add('border-blue-500', 'text-blue-600');
        usersTab.classList.remove('border-transparent', 'text-gray-500');
        transactionsTab.classList.remove('border-blue-500', 'text-blue-600');
        transactionsTab.classList.add('border-transparent', 'text-gray-500');
        
        usersPanel.classList.remove('hidden');
        transactionsPanel.classList.add('hidden');
    });
    
    transactionsTab.addEventListener('click', function() {
        transactionsTab.classList.add('border-blue-500', 'text-blue-600');
        transactionsTab.classList.remove('border-transparent', 'text-gray-500');
        usersTab.classList.remove('border-blue-500', 'text-blue-600');
        usersTab.classList.add('border-transparent', 'text-gray-500');
        
        transactionsPanel.classList.remove('hidden');
        usersPanel.classList.add('hidden');
        
        loadAdminTransactions();
    });
    
    // Foydalanuvchini tahrirlash modalini yopish
    cancelEditBtn.addEventListener('click', function() {
        editUserModal.classList.add('hidden');
    });
    
    // Foydalanuvchini saqlash
    saveUserBtn.addEventListener('click', async function() {
        if (!currentEditingUserId) return;
        
        const username = editUsername.value;
        const balance = parseFloat(editBalance.value);
        
        if (!username) {
            alert('Foydalanuvchi nomi bo\'sh bo\'lmasligi kerak');
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/users/${currentEditingUserId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    balance
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                editUserModal.classList.add('hidden');
                loadUsers();
                alert('Foydalanuvchi ma\'lumotlari yangilandi');
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Foydalanuvchini yangilash xatosi:', error);
            alert('Server xatosi');
        }
    });
    
    // Foydalanuvchi ma'lumotlarini yuklash
    async function loadUserData() {
        try {
            const response = await fetch('/api/user');
            
            if (!response.ok) {
                window.location.href = 'register-login.html';
                return;
            }
            
            const user = await response.json();
            
            usernameDisplay.textContent = user.username;
            
            // Agar admin bo'lmasa, asosiy sahifaga qaytarish
            if (!user.isAdmin) {
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('Foydalanuvchi ma\'lumotlarini yuklash xatosi:', error);
            window.location.href = 'register-login.html';
        }
    }
    
    // Foydalanuvchilarni yuklash
    async function loadUsers() {
        try {
            const response = await fetch('/api/admin/users');
            
            if (!response.ok) {
                usersContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <p class="text-lg">Foydalanuvchilarni yuklashda xatolik</p>
                    </div>
                `;
                return;
            }
            
            const users = await response.json();
            
            if (users.length === 0) {
                usersContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-users text-4xl mb-4"></i>
                        <p class="text-lg">Hozircha foydalanuvchilar mavjud emas</p>
                    </div>
                `;
                return;
            }
            
            let usersHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foydalanuvchi</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet ID</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balans</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Admin</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amallar</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
            `;
            
            users.forEach(user => {
                usersHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900">${user.username}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-500 font-mono">${user.walletId}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">$${user.balance.toFixed(2)}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                                ${user.isAdmin ? 'Ha' : 'Yo\'q'}
                            </span>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button class="text-blue-600 hover:text-blue-900 mr-3 edit-user" data-id="${user._id}">Tahrirlash</button>
                            ${!user.isAdmin ? `<button class="text-red-600 hover:text-red-900 delete-user" data-id="${user._id}">O'chirish</button>` : ''}
                        </td>
                    </tr>
                `;
            });
            
            usersHTML += `
                        </tbody>
                    </table>
                </div>
            `;
            
            usersContainer.innerHTML = usersHTML;
            
            // Tahrirlash va o'chirish tugmalariga event listener qo'shish
            document.querySelectorAll('.edit-user').forEach(button => {
                button.addEventListener('click', function() {
                    const userId = this.getAttribute('data-id');
                    openEditUserModal(userId, users);
                });
            });
            
            document.querySelectorAll('.delete-user').forEach(button => {
                button.addEventListener('click', function() {
                    const userId = this.getAttribute('data-id');
                    deleteUser(userId);
                });
            });
        } catch (error) {
            console.error('Foydalanuvchilarni yuklash xatosi:', error);
            usersContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="text-lg">Server xatosi</p>
                </div>
            `;
        }
    }
    
    // Admin tranzaksiyalarini yuklash
    async function loadAdminTransactions() {
        try {
            const response = await fetch('/api/admin/transactions');
            
            if (!response.ok) {
                adminTransactionsContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <p class="text-lg">Tranzaksiyalarni yuklashda xatolik</p>
                    </div>
                `;
                return;
            }
            
            const transactions = await response.json();
            
            if (transactions.length === 0) {
                adminTransactionsContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exchange-alt text-4xl mb-4"></i>
                        <p class="text-lg">Hozircha tranzaksiyalar mavjud emas</p>
                    </div>
                `;
                return;
            }
            
            let transactionsHTML = `
                <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200">
                        <thead class="bg-gray-50">
                            <tr>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Foydalanuvchi</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turi</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summa</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sana</th>
                                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holat</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-200">
            `;
            
            transactions.forEach(transaction => {
                const date = new Date(transaction.createdAt).toLocaleDateString('uz-UZ');
                const time = new Date(transaction.createdAt).toLocaleTimeString('uz-UZ', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const amountClass = transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600';
                const amountSign = transaction.type === 'deposit' ? '+' : '-';
                
                transactionsHTML += `
                    <tr>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900">${transaction.userId?.username || 'Noma\'lum'}</div>
                            <div class="text-sm text-gray-500 font-mono">${transaction.userId?.walletId || ''}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900 capitalize">${transaction.type}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium ${amountClass}">${amountSign}$${transaction.amount.toFixed(2)}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-500">${date}</div>
                            <div class="text-sm text-gray-500">${time}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                ${transaction.status}
                            </span>
                        </td>
                    </tr>
                `;
            });
            
            transactionsHTML += `
                        </tbody>
                    </table>
                </div>
            `;
            
            adminTransactionsContainer.innerHTML = transactionsHTML;
        } catch (error) {
            console.error('Tranzaksiyalarni yuklash xatosi:', error);
            adminTransactionsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="text-lg">Server xatosi</p>
                </div>
            `;
        }
    }
    
    // Foydalanuvchini tahrirlash modalini ochish
    function openEditUserModal(userId, users) {
        const user = users.find(u => u._id === userId);
        
        if (!user) return;
        
        currentEditingUserId = userId;
        editUsername.value = user.username;
        editBalance.value = user.balance;
        
        editUserModal.classList.remove('hidden');
    }
    
    // Foydalanuvchini o'chirish
    async function deleteUser(userId) {
        if (!confirm('Haqiqatan ham bu foydalanuvchini o\'chirmoqchimisiz?')) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (data.success) {
                loadUsers();
                alert('Foydalanuvchi muvaffaqiyatli o\'chirildi');
            } else {
                alert(data.error);
            }
        } catch (error) {
            console.error('Foydalanuvchini o\'chirish xatosi:', error);
            alert('Server xatosi');
        }
    }
});