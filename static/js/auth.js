document.addEventListener('DOMContentLoaded', () => {
            let isSignUp = false;

            const formTitle = document.getElementById('form-title');
            const submitBtn = document.getElementById('submit-btn');
            const fullNameGroup = document.getElementById('full-name-group');
            const roleGroup = document.getElementById('role-group');
            const toggleText = document.getElementById('toggle-text');
            const toggleBtn = document.getElementById('toggle-btn');
            const errorDiv = document.getElementById('error-msg');

            // Check if elements exist
            if (!submitBtn) {
                console.error('Submit button not found');
                return;
            }

            function toggleForm() {
                isSignUp = !isSignUp;
                
                formTitle.innerText = isSignUp ? 'Sign Up' : 'Login';
                submitBtn.innerText = isSignUp ? 'Sign Up' : 'Log In';
                
                if (isSignUp) {
                    fullNameGroup.classList.remove('hidden');
                    roleGroup.classList.remove('hidden');
                    toggleText.innerHTML = 'Already have an account? <span class="text-emerald-400 underline underline-offset-4">Log In</span>';
                } else {
                    fullNameGroup.classList.add('hidden');
                    roleGroup.classList.add('hidden');
                    toggleText.innerHTML = 'Don\'t have an account? <span class="text-emerald-400 underline underline-offset-4">Sign Up</span>';
                }
                
                errorDiv.innerText = '';
            }
            
            async function handleSubmit() {
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value.trim();
                const fullName = document.getElementById('full_name').value.trim();
                const role = document.getElementById('role').value;

                errorDiv.innerText = '';

                if (!email || !password || (isSignUp && !fullName) || (isSignUp && !role)) {
                    errorDiv.innerText = 'Please fill out all required fields.';
                    return;
                }

                const endpoint = isSignUp ? '/api/signup' : '/api/login';
                const payload = { email, password };
                if (isSignUp) {
                    payload.full_name = fullName;
                    payload.role = role;
                }

                try {
                    submitBtn.innerText = isSignUp ? 'Creating account...' : 'Logging In...';
                    submitBtn.disabled = true;

                    const response = await fetch(endpoint, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        if (isSignUp) {
                            alert('Account created! Switching to Login...');
                            toggleForm();
                        } else {
                            window.location.href = '/dashboard';
                        }
                    } else {
                        const data = await response.json();
                        errorDiv.innerText = data.error || 'An error occurred during authentication';

                        submitBtn.innerText = isSignUp ? 'Sign Up' : 'Log In';
                        submitBtn.disabled = false;
                    }
                } catch (err) {
                    errorDiv.innerText = 'Unable to connect to the server.';
                    submitBtn.innerText = isSignUp ? 'Sign Up' : 'Log In';
                    submitBtn.disabled = false;
                }
            }
            
            toggleBtn.addEventListener('click', toggleForm);
            submitBtn.addEventListener('click', handleSubmit);
            
            // Password toggle functionality (keeping inline onclick for simplicity)
            document.addEventListener('click', (e) => {
                const togglePasswordBtn = e.target.closest('#toggle-password');

                if (togglePasswordBtn) {
                  e.preventDefault();
                  
                  const passwordInput = document.getElementById('password');

                  if (passwordInput) {
                    const isPassword = passwordInput.type === 'password';
                    passwordInput.type = isPassword ? 'text' : 'password';
                    togglePasswordBtn.textContent = isPassword ? '🙈' : '👁️';
                }
                }
            });
        });