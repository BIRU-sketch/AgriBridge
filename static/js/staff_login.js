document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('staff-login-form');
    if (!form) return;

    const usernameInput = document.getElementById('staff-username');
    const passwordInput = document.getElementById('staff-password');
    const usernameErr = document.getElementById('staff-username-err');
    const passwordErr = document.getElementById('staff-password-err');
    const submitBtn = form.querySelector('button[type="submit"]');
    const isFilePreview = window.location.protocol === 'file:';
    const nextTarget = new URLSearchParams(window.location.search).get('next') || '';

    function clearErrors() {
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

    function setFieldError(input, errorEl, message) {
        if (input) input.setAttribute('aria-invalid', 'true');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.hidden = false;
        }
    }

    function showAlert(message) {
        const alert = form.querySelector('.form-alert');
        if (alert) {
            alert.textContent = message;
            alert.hidden = false;
        }
    }

    let formBlocked = false;
    let blockedMessage = '';

    function blockForm(message) {
        formBlocked = true;
        blockedMessage = message;
        showAlert(message);
        if (submitBtn) submitBtn.disabled = true;
    }

    if (isFilePreview) {
        blockForm('Preview only. Start the server with "python main.py", then open http://127.0.0.1:3000/staff_login to sign in.');
    } else {
        fetch('/api/staff/status', {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        })
            .then(async (response) => {
                const contentType = response.headers.get('content-type') || '';
                if (!response.ok || !contentType.includes('application/json')) {
                    throw new Error('not-agribridge');
                }
                const status = await response.json();
                if (!status.staff_login) {
                    throw new Error('not-agribridge');
                }
                if (!status.configured) {
                    blockForm('Staff sign-in is not configured. Make sure you run "python main.py" from the folder that contains main.py and .env, then restart.');
                }
            })
            .catch(() => {
                blockForm('This page is not connected to the AgriBridge server. Run "python main.py" from the folder that contains main.py and .env, then open http://127.0.0.1:3000/staff_login.');
            });
    }

    [usernameInput, passwordInput].forEach((input) => {
        input?.addEventListener('input', () => {
            input.removeAttribute('aria-invalid');
            const errorId = input.getAttribute('aria-describedby')?.split(' ').find((id) => id.endsWith('-err'));
            const errorEl = errorId ? document.getElementById(errorId) : null;
            if (errorEl) {
                errorEl.hidden = true;
                errorEl.textContent = '';
            }
        });
    });

    document.querySelectorAll('.pw-toggle').forEach((btn) => {
        btn.addEventListener('click', () => {
            const target = document.getElementById(btn.dataset.target);
            if (!target) return;
            const show = target.type === 'password';
            target.type = show ? 'text' : 'password';
            btn.setAttribute('aria-pressed', show ? 'true' : 'false');
            btn.textContent = show ? 'Hide' : 'Show';
        });
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors();

        if (isFilePreview) {
            showAlert('Start the server with "python main.py", then open http://127.0.0.1:3000/staff_login to sign in.');
            return;
        }

        if (formBlocked) {
            showAlert(blockedMessage);
            return;
        }

        const username = usernameInput?.value.trim() || '';
        const password = passwordInput?.value || '';
        let hasError = false;

        if (!username) {
            setFieldError(usernameInput, usernameErr, 'Please enter your staff username.');
            hasError = true;
        }
        if (!password) {
            setFieldError(passwordInput, passwordErr, 'Please enter your password.');
            hasError = true;
        }
        if (hasError) return;

        const originalText = submitBtn?.dataset.label || submitBtn?.textContent || 'Sign in';
        const busyText = submitBtn?.dataset.busy || 'Signing in…';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = busyText;
            }

            const response = await fetch('/api/staff/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, next: nextTarget })
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error('The AgriBridge login service is not available here. Run "python main.py", then open http://127.0.0.1:3000/staff_login.');
            }

            let data;
            try {
                data = await response.json();
            } catch {
                throw new Error('The AgriBridge server returned an invalid response. Restart it with "python main.py" and open http://127.0.0.1:3000/staff_login.');
            }

            if (!response.ok) {
                throw new Error(data.error || 'Incorrect staff username or password.');
            }

            window.location.href = data.redirect || '/admin/dashboard';
        } catch (error) {
            showAlert(error.message);
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    });
});
