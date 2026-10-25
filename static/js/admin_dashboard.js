document.addEventListener('DOMContentLoaded', () => {
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const toast = document.getElementById('toast-msg');
    const pendingCountEl = document.getElementById('metric-pending-count');
    const totalUsersEl = document.getElementById('metric-total-users');
    const bufferStockEl = document.getElementById('metric-buffer-stock');
    const tradeSettledEl = document.getElementById('metric-trade-settled');
    const verificationTbody = document.getElementById('verification-tbody');

    const vehicleInspectionTbody = document.getElementById('vehicle-inspection-tbody');
    const deliveryIssuesTbody = document.getElementById('delivery-issues-tbody');
    const agentHubAssignmentsTbody = document.getElementById('agent-hub-assignments-tbody');
    const cropPricesTbody = document.getElementById('crop-prices-tbody');
    const cropPriceForm = document.getElementById('crop-price-form');
    const hubChoices = [...(document.getElementById('staff-hub')?.options || [])].map(option => option.value).filter(Boolean);
    const pendingVehiclesBadge = document.getElementById('pending-vehicles-badge');
    const navPendingVehiclesCount = document.getElementById('nav-pending-vehicles-count');

    // Admin workspace view navigation
    const adminViewButtons = document.querySelectorAll('[data-admin-view]');
    const adminViewPanels = document.querySelectorAll('[data-admin-panel]');
    const adminViewTargets = document.querySelectorAll('[data-admin-view-target]');
    const provisionForm = document.getElementById('staff-account-form');
    const staffRoleSelect = document.getElementById('staff-role');
    const staffHubSelect = document.getElementById('staff-hub');
    const staffHubField = document.getElementById('staff-hub-field');

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

    function showAdminView(viewName) {
        adminViewPanels.forEach(panel => {
            panel.hidden = panel.dataset.adminPanel !== viewName;
        });
        adminViewButtons.forEach(button => {
            if (button.dataset.adminView === viewName) {
                button.setAttribute('aria-current', 'page');
            } else {
                button.removeAttribute('aria-current');
            }
        });
    }

    function navigateAdminView(viewName) {
        showAdminView(viewName);
        document.querySelector(`[data-admin-panel="${viewName}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    adminViewButtons.forEach(button => {
        button.addEventListener('click', () => navigateAdminView(button.dataset.adminView));
    });
    adminViewTargets.forEach(button => {
        button.addEventListener('click', () => navigateAdminView(button.dataset.adminViewTarget));
    });

    function syncStaffHubField() {
        const isAgent = staffRoleSelect?.value === 'agent';
        if (staffHubField) staffHubField.hidden = !isAgent;
        if (staffHubSelect) {
            staffHubSelect.required = Boolean(isAgent);
            if (!isAgent) staffHubSelect.value = '';
        }
    }
    staffRoleSelect?.addEventListener('change', syncStaffHubField);
    syncStaffHubField();

    // 1. Load Admin Statistics
    async function loadAdminStats() {
        try {
            const res = await fetch('/api/admin/stats');
            const data = await res.json();
            const stats = data.stats || {};

            if (totalUsersEl) totalUsersEl.textContent = stats.total_users ?? '0';
            if (pendingCountEl) pendingCountEl.textContent = stats.pending_verifications || '0';
            if (bufferStockEl) {
                bufferStockEl.innerHTML = `${Number(stats.hub_buffer_stock || 0).toLocaleString()} <small style="font-size:.9rem;font-weight:600;">Qtl</small>`;
            }
            if (tradeSettledEl) {
                const total = Number(stats.total_trade_settled_etb || 0);
                tradeSettledEl.innerHTML = `${total.toLocaleString()} <small style="font-size:.9rem;font-weight:600;">ETB</small>`;
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
            if (!res.ok) throw new Error(data.error || 'Could not load the vehicle inspection queue.');
            const vehicles = data.vehicles || [];

            if (pendingVehiclesBadge) {
                pendingVehiclesBadge.textContent = `${vehicles.length} Awaiting Inspection`;
            }
            if (navPendingVehiclesCount) {
                navPendingVehiclesCount.textContent = vehicles.length.toString();
                navPendingVehiclesCount.hidden = vehicles.length === 0;
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
                            data-vehicle="${veh.id}"
                            data-plate="${veh.plate_number}"
                            data-approved="true">
                            Approve
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm verify-veh-btn"
                            data-vehicle="${veh.id}"
                            data-plate="${veh.plate_number}"
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
                    const vehicleId = btn.dataset.vehicle;
                    const plate = btn.dataset.plate;
                    const approved = btn.dataset.approved === 'true';

                    btn.disabled = true;
                    btn.textContent = approved ? 'Approving…' : 'Rejecting…';

                    try {
                        const res = await fetch('/api/admin/verify-vehicle', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                vehicle_id: vehicleId,
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
            if (vehicleInspectionTbody) {
                vehicleInspectionTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#991B1B;">${escapeHtml(err.message || 'Could not load the vehicle inspection queue. Refresh the page to try again.')}</td></tr>`;
            }
        }
    }

    async function loadDeliveryIssues() {
        if (!deliveryIssuesTbody) return;
        try {
            const res = await fetch('/api/admin/delivery-issues');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load delivery issues.');
            const issues = data.issues || [];
            if (!issues.length) {
                deliveryIssuesTbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted);">No unresolved delivery problems have been reported.</td></tr>';
                return;
            }
            deliveryIssuesTbody.innerHTML = '';
            issues.forEach(issue => {
                const shipment = issue.shipment || {};
                const reports = issue.reports || [];
                const agentNames = reports.map(report => escapeHtml(report.agent?.full_name || report.agent?.username || 'Hub agent')).join('<br>');
                const problemText = reports.map(report => `${escapeHtml(report.agent?.full_name || report.agent?.username || 'Hub agent')} (attempt ${report.attempt_no || 1}): ${escapeHtml(report.reason || 'No reason supplied')}`).join('<br>');
                const responseDates = reports.map(report => report.responded_at ? new Date(report.responded_at).toLocaleString() : '--').join('<br>');
                const tr = document.createElement('tr');
                tr.innerHTML = `<td><strong>${escapeHtml(shipment.waybill_id || 'Transfer')}</strong><div class="meta-sub">${escapeHtml(shipment.origin_hub || '--')} → ${escapeHtml(shipment.destination_hub || '--')}</div></td>
                    <td>${agentNames}</td><td>${escapeHtml(shipment.crop_type || 'Produce')} (${escapeHtml(shipment.quality_grade || '--')})</td>
                    <td>${Number(shipment.quantity || 0).toLocaleString()} Qtl</td>
                    <td>${problemText}</td><td>${responseDates}</td>
                    <td style="white-space:nowrap;"><button class="btn btn-primary btn-sm resolve-transfer" data-action="complete">Complete</button> <button class="btn btn-outline btn-sm resolve-transfer" data-action="retry">Retry</button> <button class="btn btn-ghost btn-sm resolve-transfer" data-action="cancel">Cancel</button></td>`;
                tr.querySelectorAll('.resolve-transfer').forEach(button => {
                    button.addEventListener('click', async () => {
                        const action = button.dataset.action;
                        const note = window.prompt(`Add the admin note for ${action} transfer ${shipment.waybill_id}:`)?.trim();
                        if (!note) return;
                        button.disabled = true;
                        try {
                            const response = await fetch('/api/admin/resolve-delivery-issue', {
                                method: 'POST', headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({waybill_id: shipment.waybill_id, action, note})
                            });
                            const result = await response.json();
                            if (!response.ok) throw new Error(result.error || 'Could not resolve delivery issue.');
                            showToast(result.message || 'Delivery issue resolved.');
                            loadDeliveryIssues();
                        } catch (error) {
                            showToast(error.message);
                            button.disabled = false;
                        }
                    });
                });
                deliveryIssuesTbody.appendChild(tr);
            });
        } catch (error) {
            console.error('Failed to load delivery issues:', error);
            deliveryIssuesTbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#991B1B;">${escapeHtml(error.message || 'Could not load delivery issues.')}</td></tr>`;
        }
    }
    async function loadAgentHubAssignments() {
        if (!agentHubAssignmentsTbody) return;
        try {
            const res = await fetch('/api/admin/agents');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not load agent hub assignments.');
            const agents = data.agents || [];
            if (!agents.length) {
                agentHubAssignmentsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted);">No staff agents have been created yet.</td></tr>';
                return;
            }
            agentHubAssignmentsTbody.innerHTML = '';
            agents.forEach(agent => {
                const tr = document.createElement('tr');
                const options = ['<option value="">Select hub</option>', ...hubChoices.map(hub => `<option value="${escapeHtml(hub)}" ${agent.hub_location === hub ? 'selected' : ''}>${escapeHtml(hub)}</option>`)];
                tr.innerHTML = `<td>${escapeHtml(agent.full_name)}${agent.active ? '' : ' <span class="meta-sub">(inactive)</span>'}</td>
                    <td>${escapeHtml(agent.username)}</td><td><select class="agent-hub-select" aria-label="Hub for ${escapeHtml(agent.full_name)}">${options.join('')}</select></td>
                    <td><button type="button" class="btn btn-primary btn-sm save-agent-hub" data-agent="${escapeHtml(agent.id)}">Save hub</button></td>`;
                agentHubAssignmentsTbody.appendChild(tr);
            });
            agentHubAssignmentsTbody.querySelectorAll('.save-agent-hub').forEach(button => {
                button.addEventListener('click', async () => {
                    const row = button.closest('tr');
                    const hub = row?.querySelector('.agent-hub-select')?.value;
                    if (!hub) { showToast('Choose a hub for this agent.'); return; }
                    button.disabled = true;
                    try {
                        const response = await fetch(`/api/admin/agents/${encodeURIComponent(button.dataset.agent)}/hub`, {
                            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({hub_location:hub})
                        });
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Could not assign agent hub.');
                        showToast(result.message || 'Agent hub updated.');
                        loadAgentHubAssignments();
                        loadPendingUsers();
                    } catch (error) { showToast(error.message); button.disabled = false; }
                });
            });
        } catch (error) {
            agentHubAssignmentsTbody.innerHTML = `<tr><td colspan="4" style="color:#991B1B;text-align:center;padding:1.5rem;">${escapeHtml(error.message || 'Could not load agent assignments.')}</td></tr>`;
        }
    }

    async function loadCropPrices() {
        if (!cropPricesTbody) return;
        try {
            const response = await fetch('/api/admin/crop-prices');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load crop prices.');
            const prices = data.crop_prices || [];
            if (!prices.length) {
                cropPricesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:1.5rem;color:var(--muted);">No crop prices configured. Add the first approved rate above.</td></tr>';
                return;
            }
            cropPricesTbody.innerHTML = '';
            prices.forEach(price => {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${escapeHtml(price.crop_type)}</td><td>${Number(price.fixed_price_per_qtl).toLocaleString()} ETB / Qtl</td>
                    <td><span class="badge ${price.active ? 'badge-green' : 'badge-amber'}">${price.active ? 'Active' : 'Inactive'}</span></td>
                    <td><button type="button" class="btn btn-outline btn-sm edit-crop-price">Edit</button>
                    <button type="button" class="btn btn-ghost btn-sm toggle-crop-price">${price.active ? 'Deactivate' : 'Activate'}</button></td>`;
                row.querySelector('.edit-crop-price').addEventListener('click', () => {
                    document.getElementById('price-crop-name').value = price.crop_type;
                    document.getElementById('fixed-price-qtl').value = price.fixed_price_per_qtl;
                    document.getElementById('price-crop-name').focus();
                });
                row.querySelector('.toggle-crop-price').addEventListener('click', async event => {
                    const button = event.currentTarget;
                    button.disabled = true;
                    try {
                        const result = await fetch('/api/admin/crop-prices', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crop_type:price.crop_type,fixed_price_per_qtl:price.fixed_price_per_qtl,active:!price.active})});
                        const body = await result.json();
                        if (!result.ok) throw new Error(body.error || 'Could not update crop price.');
                        showToast(body.message || 'Crop price status updated.');
                        loadCropPrices();
                    } catch (error) { showToast(error.message); button.disabled = false; }
                });
                cropPricesTbody.appendChild(row);
            });
        } catch (error) {
            cropPricesTbody.innerHTML = `<tr><td colspan="4" style="color:#991B1B;text-align:center;padding:1.5rem;">${escapeHtml(error.message || 'Could not load crop prices.')}</td></tr>`;
        }
    }

    cropPriceForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = cropPriceForm.querySelector('button[type="submit"]');
        submit.disabled = true;
        try {
            const response = await fetch('/api/admin/crop-prices', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({crop_type:document.getElementById('price-crop-name').value.trim(),fixed_price_per_qtl:document.getElementById('fixed-price-qtl').value,active:true})});
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save crop price.');
            showToast(data.message || 'Crop price saved.');
            cropPriceForm.reset();
            loadCropPrices();
        } catch (error) { showToast(error.message); }
        finally { submit.disabled = false; }
    });

    // Form Submission: Create a staff account
    if (provisionForm) {
        provisionForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = provisionForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Creating Account…';
            }

            const payload = {
                role: document.getElementById('staff-role')?.value,
                hub_location: document.getElementById('staff-hub')?.value,
                full_name: document.getElementById('staff-name')?.value.trim(),
                username: document.getElementById('staff-username')?.value.trim(),
                company_name: document.getElementById('staff-company')?.value.trim(),
                password: document.getElementById('staff-password')?.value,
                license_ref: document.getElementById('staff-license')?.value.trim()
            };

            try {
                const res = await fetch('/api/admin/staff', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to create staff account');

                provisionForm.reset();

                showToast(`${payload.role} account created for ${payload.full_name}. Sign in: ${payload.username}`);
                loadAdminStats();
                loadAgentHubAssignments();
            } catch (err) {
                showToast(err.message || 'Error creating staff account');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Create Account';
                }
            }
        });
    }

    // Initial Execution
    loadAdminStats();
    loadPendingUsers();
    loadPendingVehicles();
    loadDeliveryIssues();
    loadAgentHubAssignments();
    loadCropPrices();
});
