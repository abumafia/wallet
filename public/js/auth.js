// Auth.js - Kirish va ro'yxatdan o'tish

document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const messageDiv = document.getElementById('message');
    
    // Agar avval kirilgan bo'lsa, asosiy sahifaga yo'naltirish
    checkAuthStatus();
    
    // Tab o'zgartirish
    loginTab.addEventListener('click', function() {
        loginTab.classList.add('text-blue-600', 'border-blue-600');
        loginTab.classList.remove('text-gray-500');
        registerTab.classList.remove('text-blue-600', 'border-blue-600');
        registerTab.classList.add('text-gray-500');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });
    
    registerTab.addEventListener('click', function() {
        registerTab.classList.add('text-blue-600', 'border-blue-600');
        registerTab.classList.remove('text-gray-500');
        loginTab.classList.remove('text-blue-600', 'border-blue-600');
        loginTab.classList.add('text-gray-500');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
    
    // Kirish formasi
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Muvaffaqiyatli kirish! Yo\'naltirilmoqda...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                showMessage(data.error, 'error');
            }
        } catch (error) {
            console.error('Kirish xatosi:', error);
            showMessage('Server xatosi', 'error');
        }
    });
    
    // Ro'yxatdan o'tish formasi
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        
        if (password !== confirmPassword) {
            showMessage('Parollar mos kelmadi', 'error');
            return;
        }
        
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showMessage('Muvaffaqiyatli ro\'yxatdan o\'tildi! Yo\'naltirilmoqda...', 'success');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1000);
            } else {
                showMessage(data.error, 'error');
            }
        } catch (error) {
            console.error('Ro\'yxatdan o\'tish xatosi:', error);
            showMessage('Server xatosi', 'error');
        }
    });
    
    // Xabarlarni ko'rsatish
    function showMessage(message, type) {
        messageDiv.textContent = message;
        messageDiv.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        
        if (type === 'success') {
            messageDiv.classList.add('bg-green-100', 'text-green-700');
        } else {
            messageDiv.classList.add('bg-red-100', 'text-red-700');
        }
        
        messageDiv.classList.remove('hidden');
        
        // 5 soniyadan so'ng xabarni yashirish
        setTimeout(() => {
            messageDiv.classList.add('hidden');
        }, 5000);
    }
    
    // Auth holatini tekshirish
    async function checkAuthStatus() {
        try {
            const response = await fetch('/api/user');
            if (response.ok) {
                // Agar foydalanuvchi avval kirgan bo'lsa, asosiy sahifaga yo'naltirish
                window.location.href = 'index.html';
            }
        } catch (error) {
            // Kirilmagan, sahifada qolish
        }
    }
});