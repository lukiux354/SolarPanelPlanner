export function initAuthUI() {
    // Get modal elements
    const authModal = document.getElementById('auth-modal');
    const modalTitle = document.getElementById('modal-title');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const errorMessage = document.getElementById('auth-error');
    
    // Get buttons
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const registerFromHeaderBtn = document.getElementById('register-from-header-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const closeBtn = document.querySelector('#auth-modal .close-modal-btn');
    
    // Form toggle links
    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');
    
    // Show login modal
    function showLoginModal() {
        modalTitle.textContent = 'Login';
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        errorMessage.style.display = 'none';
        authModal.style.display = 'flex';
        document.getElementById('login-username').focus();
    }
    
    // Show register modal
    function showRegisterModal() {
        modalTitle.textContent = 'Register';
        registerForm.style.display = 'block';
        loginForm.style.display = 'none';
        errorMessage.style.display = 'none';
        authModal.style.display = 'flex';
        document.getElementById('register-username').focus();
    }
    
    window.showRegisterModal = showRegisterModal;
    
    // Close modal
    function closeModal() {
        authModal.style.display = 'none';
        loginForm.reset();
        registerForm.reset();
        errorMessage.style.display = 'none';
    }
    
    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
    }

    async function refreshCSRFToken() {
        try {
            const response = await fetch('/solar/api/csrf-refresh/');
            const data = await response.json();
            if (data.csrf_token) {
                // Update all CSRF tokens in forms
                document.querySelectorAll('[name=csrfmiddlewaretoken]').forEach(input => {
                    input.value = data.csrf_token;
                });
                return true;
            }
        } catch (error) {
            console.error("Failed to refresh CSRF token:", error);
        }
        return false;
    }
    
    function checkGuestStatus() {
        fetch('/solar/api/user-status/')
            .then(response => response.json())
            .then(data => {
                if (data.is_authenticated && data.is_guest) {
                    // Update auth buttons section
                    const authControls = document.querySelector('.header-right #auth-controls');
                    
                    // Clear existing buttons
                    const existingRegisterBtn = document.querySelector('#register-btn');
                    if (existingRegisterBtn) {
                        // Replace regular register button with highlighted one
                        if (!document.querySelector('#register-from-header-btn')) {
                            const registerBtn = document.createElement('button');
                            registerBtn.id = 'register-from-header-btn';
                            registerBtn.className = 'auth-btn highlight';
                            registerBtn.textContent = 'Register';
                            registerBtn.addEventListener('click', showRegisterModal);
                            
                            existingRegisterBtn.parentNode.replaceChild(registerBtn, existingRegisterBtn);
                        }
                    }
                    
                    if (!document.querySelector('#login-btn')) {
                        const loginBtn = document.createElement('button');
                        loginBtn.id = 'login-btn';
                        loginBtn.className = 'auth-btn';
                        loginBtn.textContent = 'Login';
                        loginBtn.addEventListener('click', showLoginModal);
                        
                        const registerBtn = document.querySelector('#register-from-header-btn');
                        if (registerBtn) {
                            registerBtn.parentNode.insertBefore(loginBtn, registerBtn);
                        } else {
                            authControls.appendChild(loginBtn);
                        }
                    } else {
                        document.querySelector('#login-btn').style.display = '';
                    }
                    
                    if (!document.querySelector('.guest-notice')) {
                        const header = document.querySelector('header');
                        const guestNotice = document.createElement('div');
                        guestNotice.className = 'guest-notice';
                        guestNotice.innerHTML = `
                            <div class="notice-content">
                                <span class="notice-text">You're currently working as a guest. Your projects will be available for 7 days.</span>
                                <a href="#" id="register-from-guest-btn" class="btn">Register now</a>
                                <span>to save your work permanently!</span>
                            </div>
                        `;
                        header.insertAdjacentElement('afterend', guestNotice);
                        
                        document.getElementById('register-from-guest-btn').addEventListener('click', (e) => {
                            e.preventDefault();
                            showRegisterModal();
                        });
                    }
                    refreshCSRFToken();
                }
            });
    }
    
    // event listeners
    if (loginBtn) loginBtn.addEventListener('click', showLoginModal);
    if (registerBtn) registerBtn.addEventListener('click', showRegisterModal);
    if (registerFromHeaderBtn) registerFromHeaderBtn.addEventListener('click', showRegisterModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    
    document.addEventListener('click', function(event) {
        if (event.target.id === 'register-from-header-btn' || 
            event.target.id === 'register-from-guest-btn' ||
            event.target.id === 'guest-limit-register') {
            event.preventDefault();
            showRegisterModal();
        }
    });
    
    // Form toggle links
    if (showRegisterLink) showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showRegisterModal();
    });
    
    if (showLoginLink) showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showLoginModal();
    });
    
    // Close on click outside
    let mouseDownOnBackdrop = false;

    authModal.addEventListener('mousedown', (e) => {
        // Track if mousedown happened on the backdrop
        mouseDownOnBackdrop = (e.target === authModal);
    });

    authModal.addEventListener('mouseup', (e) => {
        // Only close if both mousedown AND mouseup were on backdrop
        if (e.target === authModal && mouseDownOnBackdrop) {
            closeModal();
        }
        mouseDownOnBackdrop = false;
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && authModal.style.display === 'flex') {
            closeModal();
        }
    });
    
    // Handle login form submission
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // refresh CSRF token 
            await refreshCSRFToken();
            
            const formData = new FormData(loginForm);
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            try {
                const response = await fetch('/solar/auth/login/', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    credentials: 'same-origin'
                });
                
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    
                    if (data.success) {
                        window.location.reload();
                    } else {
                        showError(data.error || 'Login failed');
                    }
                } else {
                    showError('Authentication error. Please refresh the page and try again.');
                }
            } catch (error) {
                showError('Network error. Please try again.');
                console.error('Login error:', error);
            }
        });
    }
    
    // Handle register form submission
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            //refresh CSRF token
            await refreshCSRFToken();
            
            const formData = new FormData(registerForm);
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
            
            // validate passwords
            const password1 = formData.get('password1');
            const password2 = formData.get('password2');
            
            if (password1 !== password2) {
                showError('Passwords do not match');
                return;
            }
            
            try {
                const response = await fetch('/solar/auth/register/', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'X-CSRFToken': csrfToken
                    },
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Reload page to update ui with logged in state
                    window.location.reload();
                } else {
                    showError(data.error || 'Registration failed');
                }
            } catch (error) {
                showError('Network error. Please try again.');
                console.error('Register error:', error);
            }
        });
    }
    
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                const formData = new FormData();
                const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;
                formData.append('csrfmiddlewaretoken', csrfToken);
                
                const response = await fetch('/solar/auth/logout/', {
                    method: 'POST',
                    body: formData,
                    credentials: 'same-origin'
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // refresh the CSRF token
                    await refreshCSRFToken();
                    
                    // Then reload page
                    window.location.reload();
                }
            } catch (error) {
                console.error('Logout error:', error);
                await refreshCSRFToken();
            }
        });
    }

    window.refreshCSRFToken = refreshCSRFToken;
    window.checkGuestStatus = checkGuestStatus;
    window.showLoginModal = showLoginModal;
}