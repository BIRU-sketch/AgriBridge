document.addEventListener('DOMContentLoaded', () => {
    const toast = document.getElementById('toast-msg');
    const pendingCountEl = document.getElementById('metric-pending-count');
    const totalUsersEl = document.getElementById('metric-total-users');
    const bufferStockEl = document.getElementById('metric-buffer-stock');
    const tradeSettledEl = document.getElementById('metric-trade-settled');
    const verificationTbody = document.getElementById('verification-tbody');

    const vehicleInspectionTbody = document.getElementById('vehicle-inspection-tbody');
    const pendingVehiclesBadge = document.getElementById('pending-vehicles-badge');

    // Provision Transporter modal elements
    const openProvisionBtns = document.querySelectorAll('[data-open-modal="provision-modal"]');
    const provisionModal = document.getElementById('provision-modal');
    const closeProvisionBtns = document.querySelectorAll('[data-close-modal="provision-modal"]');
    const provisionForm = document.getElementById('provision-transporter-form');

    let toastTimeout = null;

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4500);
    }

    // 1. Load Admin Statistics
    async function loadAdminStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            const stats = data.stats || {};

            if (totalUsersEl) totalUsersEl.textContent = stats.total_users || '15';
            if (pendingCountEl) pendingCountEl.textContent = stats.pending_verifications || '0';
            if (bufferStockEl) {
                bufferStockEl.innerHTML = `${(stats.hub_buffer_stock || 5350).toLocaleString()} <small style="font-size:.9rem;font-weight:600;">Qtl</small>`;
            }
            if (tradeSettledEl) {
                const millions = ((stats.total_trade_settled_etb || 89400000) / 1000000).toFixed(1);
                tradeSettledEl.innerHTML = `${millions}M <small style="font-size:.9rem;font-weight:600;">ETB</small>`;
            }
        } catch (err) {
            console.error('Failed to load admin stats:', err);
        }
    }

    // 2. Load Pending Verification Queue
    async function loadPendingUsers() {
        if (!verificationTbody) return;

        try {
            const res = await fetch('/api/admin/pending-users');
            const data = await res.json();
            const users = data.users || [];

            if (pendingCountEl) {
                pendingCountEl.textContent = users.length.toString();
            }

            if (users.length === 0) {
                verificationTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
                            User verification queue is clean! All applicant accounts have been reviewed.
                        </td>
                    </tr>
                `;
                return;
            }

            verificationTbody.innerHTML = '';
            users.forEach(user => {
                const tr = document.createElement('tr');
                const roleBadgeClass = user.role === 'agent' ? 'badge-green' : (user.role === 'buyer' ? 'badge-blue' : 'badge-purple');
                const roleLabel = user.role === 'agent' ? 'Extension Agent' : (user.role === 'buyer' ? 'Institutional Buyer' : 'Transporter Carrier');
                const dateStr = user.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'Recent';

                tr.innerHTML = `
                    <td class="code-ref">#${user.id}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${user.full_name}</div>
                        <div class="meta-sub">${user.company_name || user.email}</div>
                    </td>
                    <td>
                        <span class="badge ${roleBadgeClass}">${roleLabel}</span>
                    </td>
                    <td class="code-ref">${user.license_ref || 'Gov TIN Verified'}</td>
                    <td class="meta-sub">${dateStr}</td>
                    <td class="text-center status-col">
                        <span class="badge badge-amber">
                            <span class="badge-dot"></span> Pending Review
                        </span>
                    </td>
                    <td class="text-right" style="white-space:nowrap;">
                        <button type="button" class="btn btn-primary btn-sm verify-user-btn"
                            data-user="${user.id}"
                            data-role="${user.role}"
                            data-action="verify">
                            Approve
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm verify-user-btn"
                            data-user="${user.id}"
                            data-role="${user.role}"
                            data-action="reject">
                            Reject
                        </button>
                    </td>
                `;
                verificationTbody.appendChild(tr);
            });

            // Wire verification action buttons
            verificationTbody.querySelectorAll('.verify-user-btn').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const userId = btn.dataset.user;
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

                        showToast(data.message || `User #${userId} successfully ${isVerify ? 'verified' : 'updated'}!`);
                        loadAdminStats();
                    } catch (err) {
                        showToast(err.message || 'Error updating user status.');
                        btn.disabled = false;
                        btn.textContent = isVerify ? 'Approve' : 'Reject';
                    }
                });
            });
        } catch (err) {
            console.error('Failed to load pending users:', err);
        }
    }

    // 3. Load Vehicle Roadworthiness Inspection Queue
    async function loadPendingVehicles() {
        if (!vehicleInspectionTbody) return;

        try {
            const res = await fetch('/api/admin/pending-vehicles');
            const data = await res.json();
            const vehicles = data.vehicles || [];

            if (pendingVehiclesBadge) {
                pendingVehiclesBadge.textContent = `${vehicles.length} Awaiting Inspection`;
            }

            if (vehicles.length === 0) {
                vehicleInspectionTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
                            All registered fleet vehicles are inspected and approved for roadworthiness.
                        </td>
                    </tr>
                `;
                return;
            }

            vehicleInspectionTbody.innerHTML = '';
            vehicles.forEach(veh => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="code-ref" style="font-weight:700;">${veh.plate_number}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${veh.vehicle_type}</div>
                        <div class="meta-sub">Registered: ${veh.created_at ? new Date(veh.created_at).toLocaleDateString() : 'Recent'}</div>
                    </td>
                    <td class="text-right" style="font-weight:700; color:var(--brand);">${veh.capacity_quintals} Qtl</td>
                    <td>${veh.driver_name || 'Assigned Driver'}</td>
                    <td>${veh.phone_number || '+251 9...'}</td>
                    <td class="text-center veh-status-col">
                        <span class="badge badge-amber">
                            <span class="badge-dot"></span> Pending Approval
                        </span>
                    </td>
                    <td class="text-right" style="white-space:nowrap;">
                        <button type="button" class="btn btn-primary btn-sm verify-veh-btn"
                            data-vehicle="${veh.plate_number}"
                            data-approved="true">
                            Approve
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm verify-veh-btn"
                            data-vehicle="${veh.plate_number}"
                            data-approved="false">
                            Reject
                        </button>
                    </td>
                `;
                vehicleInspectionTbody.appendChild(tr);
            });

            // Wire vehicle inspection buttons
            vehicleInspectionTbody.querySelectorAll('.verify-veh-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const plate = btn.dataset.vehicle;
                    const approved = btn.dataset.approved === 'true';

                    btn.disabled = true;
                    btn.textContent = approved ? 'Approving…' : 'Rejecting…';

                    try {
                        const res = await fetch('/api/admin/verify-vehicle', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                vehicle_id: plate,
                                approved: approved
                            })
                        });

                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed to update vehicle');

                        const row = btn.closest('tr');
                        const statusCol = row?.querySelector('.veh-status-col');
                        if (statusCol) {
                            if (approved) {
                                statusCol.innerHTML = `
                                    <span class="badge badge-green">
                                        <span class="badge-dot"></span> Approved
                                    </span>
                                `;
                            } else {
                                statusCol.innerHTML = `
                                    <span class="badge" style="background:#FEE2E2; color:#991B1B;">
                                        Rejected
                                    </span>
                                `;
                            }
                        }

                        btn.textContent = approved ? '✓ Approved' : 'Rejected';
                        btn.classList.remove('btn-primary');
                        btn.classList.add('btn-ghost');

                        showToast(data.message || `Vehicle ${plate} inspection updated!`);
                        setTimeout(loadPendingVehicles, 1500);
                    } catch (err) {
                        showToast(err.message || 'Error updating vehicle');
                        btn.disabled = false;
                        btn.textContent = approved ? 'Approve' : 'Reject';
                    }
                });
            });
        } catch (err) {
            console.error('Failed to load pending vehicles:', err);
        }
    }

    // Modal: Provision Transporter Open / Close
    openProvisionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            provisionModal?.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    closeProvisionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            provisionModal?.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Form Submission: Provision Transporter
    if (provisionForm) {
        provisionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = provisionForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Provisioning Account…';
            }

            const payload = {
                full_name: document.getElementById('trans-name')?.value.trim(),
                company_name: document.getElementById('trans-company')?.value.trim(),
                email: document.getElementById('trans-email')?.value.trim(),
                password: document.getElementById('trans-password')?.value.trim(),
                license_ref: document.getElementById('trans-license')?.value.trim()
            };

            try {
                const res = await fetch('/api/admin/provision-transporter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to provision transporter');

                provisionModal?.classList.remove('active');
                document.body.style.overflow = '';
                provisionForm.reset();

                showToast(`Transporter ${payload.full_name} provisioned! Login: ${payload.email}`);
                loadAdminStats();
            } catch (err) {
                showToast(err.message || 'Error provisioning transporter');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Issue Account & Activate Login';
                }
            }
        });
    }

    // Initial Execution
    loadAdminStats();
    loadPendingUsers();
    loadPendingVehicles();
});
