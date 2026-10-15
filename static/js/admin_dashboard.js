document.addEventListener('DOMContentLoaded', () => {
    const toast = document.getElementById('toast-msg');
    const pendingCountEl = document.getElementById('metric-pending-count');
    let toastTimeout = null;

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4000);
    }

    // User Verification Buttons
    document.querySelectorAll('.verify-user-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const userId = btn.dataset.user || 'usr-8821';
            const role = btn.dataset.role || 'agent';
            const action = btn.dataset.action || 'verify';
            const isVerify = action === 'verify';

            btn.disabled = true;
            btn.textContent = isVerify ? 'Verifying…' : 'Processing…';

            try {
                const res = await fetch('/api/admin/verify-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: userId,
                        role: role,
                        verified: isVerify
                    })
                });

                const data = await res.json();
                const row = btn.closest('tr');
                const statusBadge = row?.querySelector('.status-col');

                if (statusBadge) {
                    if (isVerify) {
                        statusBadge.innerHTML = `
                            <span class="badge badge-green">
                                <span class="badge-dot"></span>
                                Verified
                            </span>
                        `;
                    } else {
                        statusBadge.innerHTML = `
                            <span class="badge" style="background:#FEE2E2; color:#991B1B; border:1px solid #FECACA;">
                                Suspended
                            </span>
                        `;
                    }
                }

                btn.textContent = isVerify ? '✓ Approved' : 'Suspended';
                btn.classList.remove('btn-primary');
                btn.classList.add('btn-ghost');

                if (pendingCountEl && isVerify) {
                    const current = parseInt(pendingCountEl.textContent, 10) || 4;
                    pendingCountEl.textContent = Math.max(0, current - 1).toString();
                }

                showToast(data.message || `User ${userId} successfully ${isVerify ? 'verified' : 'updated'}!`);
            } catch (err) {
                showToast(err.message || 'Error updating user status.');
                btn.disabled = false;
                btn.textContent = isVerify ? 'Approve' : 'Reject';
            }
        });
    });
});
