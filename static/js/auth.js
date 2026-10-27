document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tab-login');
    const tabSignup = document.getElementById('tab-signup');
    const segTabs = document.querySelector('.seg');
    const panelLogin = document.getElementById('panel-login');
    const panelSignup = document.getElementById('panel-signup');
    const panelForgot = document.getElementById('panel-forgot');
    const panelReset = document.getElementById('panel-reset');
    const authTop = document.getElementById('auth-top');
    const authTitle = document.getElementById('auth-title');
    const authSub = document.getElementById('auth-sub');

    // Success views
    const signupSuccess = document.getElementById('signup-success');
    const successEmail = document.getElementById('success-email');
    const goLoginBtn = document.getElementById('go-login');

    const forgotSuccess = document.getElementById('forgot-success');
    const forgotSuccessEmail = document.getElementById('forgot-success-email');
    const btnForgotToLogin = document.getElementById('btn-forgot-to-login');

    // Trigger buttons
    const btnForgotPw = document.getElementById('btn-forgot-pw');
    const btnBackToLogin = document.getElementById('btn-back-to-login');

    let recoveryAccessToken = null;

    if (!panelLogin || !panelSignup) {
        return;
    }

    // Helper: Clear error state on a form
    function clearFormErrors(form) {
        if (!form) return;
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
    function showFormAlert(form, message, isSuccess = false) {
        const alert = form.querySelector('.form-alert');
        if (alert) {
            alert.textContent = message;
            alert.hidden = false;
            if (isSuccess) {
                alert.className = 'form-success-alert';
            } else {
                alert.className = 'form-alert';
            }
        }
    }

    // Unified Tab / Mode switching
    function switchMode(mode) {
        clearFormErrors(panelLogin);
        clearFormErrors(panelSignup);
        if (panelForgot) clearFormErrors(panelForgot);
        if (panelReset) clearFormErrors(panelReset);

        if (authTop) authTop.hidden = false;
        if (signupSuccess) signupSuccess.hidden = true;
        if (forgotSuccess) forgotSuccess.hidden = true;

        if (mode === 'forgot') {
            if (segTabs) segTabs.hidden = true;
            panelLogin.hidden = true;
            panelSignup.hidden = true;
            if (panelReset) panelReset.hidden = true;
            if (panelForgot) panelForgot.hidden = false;

            authTitle.textContent = 'Reset password';
            authSub.textContent = 'Enter your email address and we\'ll send you a recovery link.';

            // Prefill email if entered in login
            const loginEmailVal = document.getElementById('login-email')?.value.trim();
            const forgotEmailInput = document.getElementById('forgot-email');
            if (forgotEmailInput && loginEmailVal) {
                forgotEmailInput.value = loginEmailVal;
            }
            forgotEmailInput?.focus();
        } else if (mode === 'reset') {
            if (segTabs) segTabs.hidden = true;
            panelLogin.hidden = true;
            panelSignup.hidden = true;
            if (panelForgot) panelForgot.hidden = true;
            if (panelReset) panelReset.hidden = false;

            authTitle.textContent = 'Set new password';
            authSub.textContent = 'Choose a password with at least 8 characters.';
        } else if (mode === 'signup') {
            if (segTabs) segTabs.hidden = false;
            tabSignup?.setAttribute('aria-selected', 'true');
            tabSignup?.removeAttribute('tabindex');
            tabLogin?.setAttribute('aria-selected', 'false');
            tabLogin?.setAttribute('tabindex', '-1');

            panelSignup.hidden = false;
            panelLogin.hidden = true;
            if (panelForgot) panelForgot.hidden = true;
            if (panelReset) panelReset.hidden = true;

            authTitle.textContent = 'Create an account';
            authSub.textContent = 'Register to browse regional hub inventory and place commodity orders.';
        } else {
            // Default: 'login'
            if (segTabs) segTabs.hidden = false;
            tabLogin?.setAttribute('aria-selected', 'true');
            tabLogin?.removeAttribute('tabindex');
            tabSignup?.setAttribute('aria-selected', 'false');
            tabSignup?.setAttribute('tabindex', '-1');

            panelLogin.hidden = false;
            panelSignup.hidden = true;
            if (panelForgot) panelForgot.hidden = true;
            if (panelReset) panelReset.hidden = true;

            authTitle.textContent = 'Welcome back';
            authSub.textContent = 'Sign in to access real-time stock, orders, and delivery waybills.';
        }
    }

    if (tabLogin && tabSignup) {
        tabLogin.addEventListener('click', () => switchMode('login'));
        tabSignup.addEventListener('click', () => switchMode('signup'));

        // Keyboard arrow navigation on tabs
        [tabLogin, tabSignup].forEach((tab) => {
            tab.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    if (tab === tabLogin) {
                        tabSignup.focus();
                        switchMode('signup');
                    } else {
                        tabLogin.focus();
                        switchMode('login');
                    }
                }
            });
        });
    }

    if (btnForgotPw) {
        btnForgotPw.addEventListener('click', () => switchMode('forgot'));
    }

    if (btnBackToLogin) {
        btnBackToLogin.addEventListener('click', () => switchMode('login'));
    }

    // Check URL parameters, hash tokens (e.g. Supabase email recovery callback)
    const urlParams = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hashStr);

    // Supabase redirects password recovery with #access_token=...&type=recovery
    if (hashParams.get('type') === 'recovery' && hashParams.get('access_token')) {
        recoveryAccessToken = hashParams.get('access_token');
        switchMode('reset');
    } else if (urlParams.get('mode') === 'reset') {
        switchMode('reset');
    } else if (urlParams.get('mode') === 'forgot') {
        switchMode('forgot');
    } else if (urlParams.get('mode') === 'signup' || window.location.hash === '#signup') {
        switchMode('signup');
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
    [panelLogin, panelSignup, panelForgot, panelReset].filter(Boolean).forEach((form) => {
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

    // 1. Login Form Submit
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

        const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Sign In';
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

            window.location.href = '/dashboard';
        } catch (err) {
            showFormAlert(panelLogin, err.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });

    // 2. Signup Form Submit
    panelSignup.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearFormErrors(panelSignup);

        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');
        const nameErr = document.getElementById('signup-name-err');
        const emailErr = document.getElementById('signup-email-err');
        const passwordErr = document.getElementById('signup-password-err');
        const submitBtn = panelSignup.querySelector('button[type="submit"]');

        const fullName = nameInput?.value.trim() || '';
        const email = emailInput?.value.trim() || '';
        const password = passwordInput?.value || '';

        let hasError = false;
        let firstInvalidInput = null;

        if (!fullName) {
            setFieldError(nameInput, nameErr, 'Please enter your full name.');
            hasError = true;
            firstInvalidInput = firstInvalidInput || nameInput;
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

        const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Create Account';
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
                switchMode('login');
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

    // 3. Forgot Password Form Submit
    if (panelForgot) {
        panelForgot.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormErrors(panelForgot);

            const emailInput = document.getElementById('forgot-email');
            const emailErr = document.getElementById('forgot-email-err');
            const submitBtn = panelForgot.querySelector('button[type="submit"]');

            const email = emailInput?.value.trim() || '';
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email) {
                setFieldError(emailInput, emailErr, 'Please enter your registered email address.');
                return;
            } else if (!emailRegex.test(email)) {
                setFieldError(emailInput, emailErr, 'Please enter a valid email address.');
                return;
            }

            const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Send reset link';
            const busyText = submitBtn?.dataset.busy || 'Sending reset link…';

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = busyText;
                }

                const response = await fetch('/api/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to send reset link.');
                }

                if (forgotSuccess && forgotSuccessEmail) {
                    if (authTop) authTop.hidden = true;
                    panelForgot.hidden = true;
                    forgotSuccessEmail.textContent = email;
                    forgotSuccess.hidden = false;
                    forgotSuccess.focus();
                } else {
                    showFormAlert(panelForgot, data.message, true);
                }
            } catch (err) {
                showFormAlert(panelForgot, err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        });
    }

    // 4. Update New Password Form Submit (after recovery link)
    if (panelReset) {
        panelReset.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormErrors(panelReset);

            const passInput = document.getElementById('reset-password');
            const confirmInput = document.getElementById('reset-password-confirm');
            const passErr = document.getElementById('reset-password-err');
            const confirmErr = document.getElementById('reset-password-confirm-err');
            const submitBtn = panelReset.querySelector('button[type="submit"]');

            const newPass = passInput?.value || '';
            const confirmPass = confirmInput?.value || '';

            let hasError = false;
            if (!newPass) {
                setFieldError(passInput, passErr, 'Please enter a new password.');
                hasError = true;
            } else if (newPass.length < 8) {
                setFieldError(passInput, passErr, 'Password must be at least 8 characters long.');
                hasError = true;
            }

            if (!confirmPass) {
                setFieldError(confirmInput, confirmErr, 'Please confirm your new password.');
                hasError = true;
            } else if (newPass !== confirmPass) {
                setFieldError(confirmInput, confirmErr, 'Passwords do not match.');
                hasError = true;
            }

            if (hasError) return;

            const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Update password';
            const busyText = submitBtn?.dataset.busy || 'Updating password…';

            try {
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.textContent = busyText;
                }

                const response = await fetch('/api/update-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password: newPass,
                        access_token: recoveryAccessToken
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to update password.');
                }

                alert(data.message || 'Password updated successfully! Please log in.');
                switchMode('login');
            } catch (err) {
                showFormAlert(panelReset, err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
            }
        });
    }

    // Return to log in from success views
    if (goLoginBtn) {
        goLoginBtn.addEventListener('click', () => {
            if (signupSuccess) signupSuccess.hidden = true;
            if (authTop) authTop.hidden = false;

            const registeredEmail = successEmail?.textContent;
            switchMode('login');

            if (registeredEmail) {
                const loginEmailInput = document.getElementById('login-email');
                if (loginEmailInput) loginEmailInput.value = registeredEmail;
                document.getElementById('login-password')?.focus();
            }
        });
    }

    if (btnForgotToLogin) {
        btnForgotToLogin.addEventListener('click', () => {
            if (forgotSuccess) forgotSuccess.hidden = true;
            if (authTop) authTop.hidden = false;

            const emailVal = forgotSuccessEmail?.textContent;
            switchMode('login');

            if (emailVal) {
                const loginEmailInput = document.getElementById('login-email');
                if (loginEmailInput) loginEmailInput.value = emailVal;
                document.getElementById('login-password')?.focus();
            }
        });
    }
});
