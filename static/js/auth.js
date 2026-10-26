document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const panelLogin = document.getElementById('panel-login');
    const panelSignup = document.getElementById('panel-signup');
    const authTop = document.getElementById('auth-top');
    const authTitle = document.getElementById('auth-title');
    const authSub = document.getElementById('auth-sub');
    const signupSuccess = document.getElementById('signup-success');
    const successEmail = document.getElementById('success-email');
    const goLoginBtn = document.getElementById('go-login');

    if (!panelLogin || !panelSignup) {
        return;
    }

    // Helper: Clear error state on a form
    function clearFormErrors(form) {
        const alert = form.querySelector('.form-alert');
        if (alert) {
            alert.hidden = true;
            alert.textContent = '';
        }
        form.querySelectorAll('.field-err').forEach((el) => {
            el.hidden = true;
            el.textContent = '';
        });
        form.querySelectorAll('[aria-invalid="true"]').forEach((el) => {
            el.removeAttribute('aria-invalid');
        });
    }

    // Helper: Show field error
    function setFieldError(inputEl, errEl, message) {
        if (inputEl) {
            inputEl.setAttribute('aria-invalid', 'true');
        }
        if (errEl) {
            errEl.textContent = message;
            errEl.hidden = false;
        }
    }

    // Helper: Show general form alert error
    function showFormAlert(form, message) {
        const alert = form.querySelector('.form-alert');
        if (alert) {
            alert.textContent = message;
            alert.hidden = false;
        }
    }

    // Tab switching
    function switchTab(mode) {
        clearFormErrors(panelLogin);
        clearFormErrors(panelSignup);

        if (mode === 'signup') {
            tabSignup.setAttribute('aria-selected', 'true');
            tabSignup.removeAttribute('tabindex');
            tabLogin.setAttribute('aria-selected', 'false');
            tabLogin.setAttribute('tabindex', '-1');

            panelSignup.hidden = false;
            panelLogin.hidden = true;

            authTitle.textContent = 'Create account';
            authSub.textContent = 'Join AgriBridge to trade or transport produce across Ethiopia.';
        } else {
            tabLogin.setAttribute('aria-selected', 'true');
            tabLogin.removeAttribute('tabindex');
            tabSignup.setAttribute('aria-selected', 'false');
            tabSignup.setAttribute('tabindex', '-1');

            panelLogin.hidden = false;
            panelSignup.hidden = true;

            authTitle.textContent = 'Log in';
            authSub.textContent = 'Welcome back. Enter your details to continue.';
        }
    }

    if (tabLogin && tabSignup) {
        tabLogin.addEventListener('click', () => switchTab('login'));
        tabSignup.addEventListener('click', () => switchTab('signup'));

        // Keyboard arrow navigation on tabs
        [tabLogin, tabSignup].forEach((tab) => {
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (tab === tabLogin) {
                        tabSignup.focus();
                        switchTab('signup');
                    } else {
                        tabLogin.focus();
                        switchTab('login');
                    }
                }
            });
        });
    }

    // Handle URL parameters or hashes (e.g., /auth?mode=signup&role=agent)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('mode') === 'signup' || window.location.hash === '#signup') {
        switchTab('signup');
    }
    const roleParam = urlParams.get('role');
    if (roleParam) {
        const matchingRadio = panelSignup.querySelector(`input[name="role"][value="${roleParam}"]`);
        if (matchingRadio) {
            matchingRadio.checked = true;
        }
    }

    // Password visibility toggle
    document.querySelectorAll('.pw-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const targetId = btn.dataset.target;
            const targetInput = document.getElementById(targetId);
            if (!targetInput) return;

            const isPassword = targetInput.type === 'password';
            targetInput.type = isPassword ? 'text' : 'password';
            btn.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
            btn.textContent = isPassword ? 'Hide' : 'Show';
        });
    });

    // Clear field errors as user interacts with inputs
    [panelLogin, panelSignup].forEach((form) => {
        form.addEventListener('input', (e) => {
            const input = e.target;
            input.removeAttribute('aria-invalid');
            const errId = input.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-err'));
            if (errId) {
                const errEl = document.getElementById(errId);
                if (errEl) {
                    errEl.hidden = true;
                    errEl.textContent = '';
                }
            }
        });
    });

    // Login Form Submit
    panelLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(panelLogin);

        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');
        const emailErr = document.getElementById('login-email-err');
        const passwordErr = document.getElementById('login-password-err');
        const submitBtn = panelLogin.querySelector('button[type="submit"]');

        const email = emailInput?.value.trim() || '';
        const password = passwordInput?.value || '';

        let hasError = false;
        if (!email) {
            setFieldError(emailInput, emailErr, 'Please enter your email.');
            hasError = true;
        }
        if (!password) {
            setFieldError(passwordInput, passwordErr, 'Please enter your password.');
            hasError = true;
        }

        if (hasError) return;

        const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Log in';
        const busyText = submitBtn?.dataset.busy || 'Logging in…';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = busyText;
            }

            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Invalid email or password.');
            }

            window.location.href = data.redirect || '/dashboard';
        } catch (err) {
            showFormAlert(panelLogin, err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });

    // Signup Form Submit
    panelSignup.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(panelSignup);

        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');
        const roleInputs = panelSignup.querySelectorAll('input[name="role"]');

        const nameErr = document.getElementById('signup-name-err');
        const roleErr = document.getElementById('signup-role-err');
        const emailErr = document.getElementById('signup-email-err');
        const passwordErr = document.getElementById('signup-password-err');
        const submitBtn = panelSignup.querySelector('button[type="submit"]');

        const fullName = nameInput?.value.trim() || '';
        const email = emailInput?.value.trim() || '';
        const password = passwordInput?.value || '';
        const selectedRole = Array.from(roleInputs).find((r) => r.checked)?.value;

        let hasError = false;
        let firstInvalidInput = null;

        if (!fullName) {
            setFieldError(nameInput, nameErr, 'Please enter your full name.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || nameInput;
        }

        if (!selectedRole) {
            setFieldError(null, roleErr, 'Please select how you will use AgriBridge.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || roleInputs[0];
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) {
            setFieldError(emailInput, emailErr, 'Please enter your email.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || emailInput;
        } else if (!emailRegex.test(email)) {
            setFieldError(emailInput, emailErr, 'Please enter a valid email address.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || emailInput;
        }

        if (!password) {
            setFieldError(passwordInput, passwordErr, 'Please enter a password.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || passwordInput;
        } else if (password.length < 8) {
            setFieldError(passwordInput, passwordErr, 'Password must be at least 8 characters long.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || passwordInput;
        }

        if (hasError) {
            if (firstInvalidInput) firstInvalidInput.focus();
            return;
        }

        const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Create account';
        const busyText = submitBtn?.dataset.busy || 'Creating account…';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = busyText;
            }

            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: fullName,
                    role: selectedRole,
                    email,
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to create account.');
            }

            // Success view
            if (signupSuccess && successEmail) {
                if (authTop) authTop.hidden = true;
                panelSignup.hidden = true;
                successEmail.textContent = email;
                signupSuccess.hidden = false;
                signupSuccess.focus();
            } else {
                alert('Account created successfully! Please log in.');
                switchTab('login');
            }
        } catch (err) {
            showFormAlert(panelSignup, err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });

    // "Go to log in" button from signup success card
    if (goLoginBtn) {
        goLoginBtn.addEventListener('click', () => {
            if (signupSuccess) signupSuccess.hidden = true;
            if (authTop) authTop.hidden = false;

            const registeredEmail = successEmail?.textContent;
            switchTab('login');

            if (registeredEmail) {
                const loginEmailInput = document.getElementById('login-email');
                if (loginEmailInput) {
                    loginEmailInput.value = registeredEmail;
                }
                const loginPasswordInput = document.getElementById('login-password');
                if (loginPasswordInput) {
                    loginPasswordInput.focus();
                }
            }
        });
    }
});
