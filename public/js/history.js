// History.js - Tranzaksiya tarixi sahifasi

document.addEventListener('DOMContentLoaded', function() {
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtn = document.getElementById('logout-btn');
    const transactionsContainer = document.getElementById('transactions-container');
    const adminLink = document.getElementById('admin-link');
    
    // Sahifa yuklanganda foydalanuvchi ma'lumotlarini yuklash
    loadUserData();
    loadTransactions();
    
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
            
            // Agar admin bo'lsa, admin linkini ko'rsatish
            if (user.isAdmin) {
                adminLink.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Foydalanuvchi ma\'lumotlarini yuklash xatosi:', error);
            window.location.href = 'register-login.html';
        }
    }
    
    // Tranzaksiyalarni yuklash
    async function loadTransactions() {
        try {
            const response = await fetch('/api/transactions');
            
            if (!response.ok) {
                transactionsContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                        <p class="text-lg">Tranzaksiyalarni yuklashda xatolik</p>
                    </div>
                `;
                return;
            }
            
            const transactions = await response.json();
            
            if (transactions.length === 0) {
                transactionsContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-exchange-alt text-4xl mb-4"></i>
                        <p class="text-lg">Hozircha tranzaksiyalar mavjud emas</p>
                    </div>
                `;
                return;
            }
            
            let transactionsHTML = '';
            
            transactions.forEach(transaction => {
                const date = new Date(transaction.createdAt).toLocaleDateString('uz-UZ');
                const time = new Date(transaction.createdAt).toLocaleTimeString('uz-UZ', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
                
                const amountClass = transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600';
                const amountSign = transaction.type === 'deposit' ? '+' : '-';
                const icon = transaction.type === 'deposit' ? 'fa-arrow-down' : 'fa-arrow-up';
                const bgColor = transaction.type === 'deposit' ? 'bg-green-100' : 'bg-red-100';
                const iconColor = transaction.type === 'deposit' ? 'text-green-600' : 'text-red-600';
                
                transactionsHTML += `
                    <div class="border border-gray-200 rounded-lg p-4 mb-4">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center">
                                <div class="flex-shrink-0 w-12 h-12 ${bgColor} rounded-full flex items-center justify-center">
                                    <i class="fas ${icon} ${iconColor}"></i>
                                </div>
                                <div class="ml-4">
                                    <p class="text-sm font-medium text-gray-900">${transaction.description}</p>
                                    <p class="text-xs text-gray-500">${date} ${time}</p>
                                </div>
                            </div>
                            <div class="text-right">
                                <p class="text-lg font-bold ${amountClass}">${amountSign}$${transaction.amount.toFixed(2)}</p>
                                <p class="text-xs text-gray-500 capitalize">${transaction.type}</p>
                            </div>
                        </div>
                        ${transaction.fromWallet || transaction.toWallet ? `
                        <div class="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                            ${transaction.fromWallet ? `<p>Qayerdan: ${transaction.fromWallet}</p>` : ''}
                            ${transaction.toWallet ? `<p>Qayerga: ${transaction.toWallet}</p>` : ''}
                        </div>
                        ` : ''}
                    </div>
                `;
            });
            
            transactionsContainer.innerHTML = transactionsHTML;
        } catch (error) {
            console.error('Tranzaksiyalarni yuklash xatosi:', error);
            transactionsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                    <p class="text-lg">Server xatosi</p>
                </div>
            `;
        }
    }
});