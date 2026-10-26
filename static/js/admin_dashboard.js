document.addEventListener('DOMContentLoaded', () => {
    const toast = document.getElementById('toast-msg');
    const pendingCountEl = document.getElementById('metric-pending-count');
    const verificationTbody = document.getElementById('verification-tbody');
    const exportAuditBtn = document.getElementById('export-audit-btn');
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

    function countPendingRows() {
        if (!verificationTbody) return 0;
        return verificationTbody.querySelectorAll('tr[data-status="pending"]').length;
    }

    function syncPendingCount(value) {
        if (!pendingCountEl) return;
        const next = Number.isFinite(value) ? value : countPendingRows();
        pendingCountEl.textContent = String(Math.max(0, next));
    }

    function statusMarkup(status) {
        if (status === 'verified') {
            return `
                <span class="badge badge-green">
                    <span class="badge-dot"></span> Verified
                </span>
            `;
        }
        if (status === 'suspended') {
            return '<span class="badge badge-red">Suspended</span>';
        }
        return `
            <span class="badge badge-amber">
                <span class="badge-dot"></span> Pending Review
            </span>
        `;
    }

    function actionMarkup(status, userId, role) {
        if (status === 'verified') {
            return `
                <button type="button" class="btn btn-ghost btn-sm verify-user-btn"
                    data-user="${userId}" data-role="${role}" data-action="reject"
                    title="Suspend this verified account">
                    Revoke
                </button>
            `;
        }
        if (status === 'suspended') {
            return `
                <button type="button" class="btn btn-primary btn-sm verify-user-btn"
                    data-user="${userId}" data-role="${role}" data-action="verify"
                    title="Restore verification for this account">
                    Reinstate
                </button>
            `;
        }
        return `
            <button type="button" class="btn btn-primary btn-sm verify-user-btn"
                data-user="${userId}" data-role="${role}" data-action="verify">
                Approve
            </button>
            <button type="button" class="btn btn-ghost btn-sm verify-user-btn"
                data-user="${userId}" data-role="${role}" data-action="reject">
                Reject
            </button>
        `;
    }

    function renderRowState(row, status) {
        row.dataset.status = status;

        const statusCol = row.querySelector('.status-col');
        if (statusCol) statusCol.innerHTML = statusMarkup(status);

        const actionCol = row.querySelector('.action-col');
        if (actionCol) {
            actionCol.innerHTML = actionMarkup(
                status,
                row.dataset.user || '',
                row.dataset.role || 'agent'
            );
        }
    }

    // Keep the KPI in sync with the actual verification queue.
    syncPendingCount();

    // Event delegation means rows can be re-rendered without losing listeners.
    if (verificationTbody) {
        verificationTbody.addEventListener('click', async (event) => {
            const btn = event.target.closest('.verify-user-btn');
            if (!btn) return;

            const row = btn.closest('tr');
            if (!row) return;

            const userId = row.dataset.user || btn.dataset.user || '';
            const role = row.dataset.role || btn.dataset.role || 'agent';
            const isVerify = btn.dataset.action === 'verify';

            if (!userId) {
                showToast('This user record is missing an ID.');
                return;
            }

            const rowButtons = row.querySelectorAll('.verify-user-btn');
            const originalLabels = new Map();
            rowButtons.forEach((button) => {
                originalLabels.set(button, button.textContent.trim());
                button.disabled = true;
            });
            btn.textContent = isVerify ? 'Processing…' : 'Updating…';

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

                let data = {};
                try {
                    data = await res.json();
                } catch (parseError) {
                    data = {};
                }

                if (!res.ok) {
                    throw new Error(data.error || 'Unable to update this user.');
                }

                renderRowState(row, data.status || (isVerify ? 'verified' : 'suspended'));
                syncPendingCount(Number(data.pending_count));
                showToast(data.message || `User ${userId} updated successfully.`);
            } catch (err) {
                rowButtons.forEach((button) => { button.disabled = false; });
                btn.textContent = originalLabels.get(btn) || (isVerify ? 'Approve' : 'Reject');
                showToast(err.message || 'Error updating user status.');
            }
        });
    }

    // Build a real, downloadable CSV from the audit ledger currently on screen.
    if (exportAuditBtn) {
        exportAuditBtn.addEventListener('click', () => {
            const table = document.getElementById('audit-table');
            if (!table) {
                showToast('The audit ledger is not available.');
                return;
            }

            const rows = Array.from(table.querySelectorAll('tr'));
            const csvRows = rows.map((row) => {
                return Array.from(row.querySelectorAll('th, td')).map((cell) => {
                    const text = (cell.innerText || cell.textContent || '')
                        .replace(/\s+/g, ' ')
                        .trim();
                    return `"${text.replace(/"/g, '""')}"`;
                }).join(',');
            });

            if (!csvRows.length) {
                showToast('There is no audit data to export.');
                return;
            }

            const csv = '\uFEFF' + csvRows.join('\r\n');
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            const stamp = new Date().toISOString().slice(0, 10);

            link.href = url;
            link.download = `agribridge-audit-${stamp}.csv`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(url);

            showToast('Audit log exported to CSV.');
        });
    }

    // Keep anchor navigation state in sync with the chosen section and make
    // in-page navigation resilient if the target is missing.
    const navLinks = Array.from(document.querySelectorAll('.dash-nav a[href^="#"]'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    navLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            const hash = link.getAttribute('href') || '';
            const target = hash.length > 1 ? document.getElementById(hash.slice(1)) : null;

            if (!target) {
                event.preventDefault();
                showToast('That section could not be found on this page.');
                return;
            }

            event.preventDefault();
            navLinks.forEach((other) => other.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'true');

            target.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth',
                block: 'start'
            });

            if (typeof target.focus === 'function') {
                target.focus({ preventScroll: true });
            }

            if (history.replaceState) {
                history.replaceState(null, '', hash);
            }
        });
    });
});
