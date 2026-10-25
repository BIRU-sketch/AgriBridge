document.addEventListener('DOMContentLoaded', () => {
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
    const toast = document.getElementById('toast-msg');
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

    const farmerSearch = document.getElementById('farmer-search');
    const farmersTbody = document.getElementById('farmers-tbody');
    const produceLotsTbody = document.getElementById('produce-lots-tbody');
    const salesOrdersTbody = document.getElementById('sales-orders-tbody');
    const transferApprovalsTbody = document.getElementById('transfer-approvals-tbody');
    const supplyForm = document.getElementById('hub-supply-form');
    const supplyCrop = document.getElementById('supply-crop');
    const supplyRequestsTbody = document.getElementById('supply-requests-tbody');
    const lotEditModal = document.getElementById('lot-edit-modal');
    const lotEditForm = document.getElementById('lot-edit-form');
    const lotEditCrop = document.getElementById('edit-lot-crop');
    const lotEditPrice = document.getElementById('edit-lot-price');

    const metricFarmers = document.getElementById('metric-registered-farmers');
    const metricLots = document.getElementById('metric-active-lots');
    const metricVolume = document.getElementById('metric-aggregated-volume');

    let loadedFarmers = [];
    let loadedCropPrices = [];
    let loadedLotsById = new Map();

    async function loadCropPrices() {
        try {
            const response = await fetch('/api/agent/crop-prices');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load crop prices.');
            loadedCropPrices = data.crop_prices || [];
            if (supplyCrop) {
                supplyCrop.innerHTML = loadedCropPrices.length
                    ? '<option value="">Choose a crop</option>' + loadedCropPrices.map(row => `<option value="${escapeHtml(row.crop_type)}">${escapeHtml(row.crop_type)}</option>`).join('')
                    : '<option value="">No active crop prices configured</option>';
            }
        } catch (error) { console.error('Could not load fixed crop prices:', error); }
    }

    function updateLotEditPrice() {
        const rate = lotEditCrop?.selectedOptions[0]?.dataset.rate;
        if (lotEditPrice) lotEditPrice.textContent = rate && Number(rate) > 0 ? `Fixed rate: ${Number(rate).toLocaleString()} ETB / Qtl` : 'This crop has no active price and cannot be saved.';
    }
    function fillLotEditCrops(selectedCrop) {
        if (!lotEditCrop) return;
        const options = [...loadedCropPrices];
        if (selectedCrop && !options.some(row => row.crop_type === selectedCrop)) options.push({crop_type:selectedCrop,fixed_price_per_qtl:0,active:false});
        lotEditCrop.innerHTML = options.map(row => `<option value="${escapeHtml(row.crop_type)}" data-rate="${Number(row.fixed_price_per_qtl || 0)}">${escapeHtml(row.crop_type)}${row.active === false ? ' (inactive price)' : ''}</option>`).join('');
        lotEditCrop.value = selectedCrop || '';
        updateLotEditPrice();
    }
    lotEditCrop?.addEventListener('change', updateLotEditPrice);
    function closeLotEditor() { lotEditModal?.classList.remove('active'); document.body.style.overflow = ''; }
    document.querySelectorAll('[data-close-lot-modal]').forEach(button => button.addEventListener('click', closeLotEditor));
    lotEditModal?.addEventListener('click', event => { if (event.target === lotEditModal) closeLotEditor(); });

    // Helper: render farmers table
    function renderFarmers(farmers) {
        if (!farmersTbody) return;

        if (!farmers || farmers.length === 0) {
            farmersTbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center; padding:2.5rem 1rem; color:var(--muted);">
                        No smallholder farmers onboarded yet. Click <strong>"+ Onboard Farmer"</strong> to register your first farmer.
                    </td>
                </tr>
            `;
            return;
        }

        farmersTbody.innerHTML = '';
        farmers.forEach((farmer) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="code-ref">${farmer.kebele_id || 'KBL-000'}</td>
                <td>
                    <div style="font-weight:700; color:var(--deep);">${farmer.full_name || 'Smallholder Farmer'}</div>
                    <div class="meta-sub">${farmer.cooperative || 'Local Farmers Cooperative'}</div>
                </td>
                <td>${farmer.woreda || 'District'} &bull; ${farmer.kebele || 'Rural'}</td>
                <td class="text-right" style="font-weight:700;">${farmer.land_size_hectares || farmer.land_size || 1.0} Ha</td>
                <td>${farmer.primary_crop || 'Grain'}</td>
                <td>${(farmer.payout_method || 'CBE').replace(/_/g, ' ').toUpperCase()}: ${farmer.account_number || 'Registered'}</td>
                <td class="text-center">
                    <span class="badge ${farmer.verified !== false ? 'badge-green' : 'badge-amber'}">
                        <span class="badge-dot"></span> ${farmer.verified !== false ? 'Verified' : 'Pending'}
                    </span>
                </td>
                <td class="text-right">
                    <a href="/add-produce-lot?kebele_id=${encodeURIComponent(farmer.kebele_id || '')}" class="action-link">
                        + Add Harvest
                    </a>
                </td>
            `;
            farmersTbody.appendChild(tr);
        });
    }

    // 1. Fetch & Load Farmers
    async function fetchFarmers() {
        if (!farmersTbody) return;
        try {
            const res = await fetch('/api/agent/farmers');
            const data = await res.json();
            loadedFarmers = data.farmers || [];

            if (metricFarmers) {
                metricFarmers.innerHTML = `${loadedFarmers.length} <small style="font-size:.9rem;font-weight:600;">Farmers</small>`;
            }

            renderFarmers(loadedFarmers);
        } catch (err) {
            console.error('Error fetching farmers:', err);
        }
    }

    // 2. Fetch & Load Produce Lots
    async function fetchProduceLots() {
        if (!produceLotsTbody) return;
        try {
            const res = await fetch('/api/agent/produce-lots');
            const data = await res.json();
            const lots = data.lots || [];
            loadedLotsById = new Map(lots.map(lot => [String(lot.id), lot]));

            let totalVolume = 0;
            lots.forEach((lot) => {
                totalVolume += parseFloat(lot.quantity || 0);
            });

            if (metricLots) {
                metricLots.innerHTML = `${lots.length} <small style="font-size:.9rem;font-weight:600;">Lots</small>`;
            }
            if (metricVolume) {
                const roundedVol = Math.round(totalVolume);
                metricVolume.innerHTML = `${roundedVol.toLocaleString()} <small style="font-size:.9rem;font-weight:600;">Qtl</small>`;
            }

            if (lots.length === 0) {
                produceLotsTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2.5rem 1rem; color:var(--muted);">
                            No produce lots aggregated yet. Click <strong>"+ Add Produce Lot"</strong> to publish available crops.
                        </td>
                    </tr>
                `;
                return;
            }

            produceLotsTbody.innerHTML = '';
            lots.forEach((lot) => {
                const tr = document.createElement('tr');
                const qty = parseFloat(lot.quantity || 0);
                const isAvailable = qty > 0;
                const isEditable = lot.status === 'In Hub Silo' && qty > 0 && Number(lot.initial_quantity) === qty;
                const lotRef = lot.lot_ref || `#LOT-${(lot.id || '000').toString().slice(-4).toUpperCase()}`;

                tr.innerHTML = `
                    <td class="code-ref">${lotRef}</td>
                    <td class="code-ref">${lot.farmer_kebele_id || 'KBL-REG'}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${escapeHtml(lot.crop_type || 'Commodity')}</div>
                        <div class="meta-sub">${escapeHtml(lot.quality_grade || 'Standard Grade')}</div>
                        <div class="meta-sub">${Number(lot.price_per_qtl || 0).toLocaleString()} ETB / Qtl</div>
                        <div class="meta-sub">Stock at ${escapeHtml(lot.hub_location || 'Hub pending')}</div>
                    </td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${qty} Qtl</td>
                    <td class="meta-sub">${escapeHtml(lot.harvest_date || 'Recent')}</td>
                    <td class="text-center">
                        <span class="badge ${isAvailable ? 'badge-green' : 'badge-amber'}">
                            <span class="badge-dot"></span> ${lot.status || (isAvailable ? 'In Hub Silo' : 'Dispatched')}
                        </span>
                    </td>
                    <td class="text-right">${isEditable ? `<button type="button" class="action-link edit-lot" data-id="${escapeHtml(lot.id)}">Edit</button> <button type="button" class="action-link remove-lot" data-id="${escapeHtml(lot.id)}">Remove</button>` : '<span class="meta-sub" title="This lot has ordered or reserved stock">Committed</span>'}</td>
                `;
                produceLotsTbody.appendChild(tr);
            });
            produceLotsTbody.querySelectorAll('.edit-lot').forEach(button => button.addEventListener('click', () => {
                const lot = loadedLotsById.get(button.dataset.id);
                if (!lot || !lotEditModal) return;
                document.getElementById('edit-lot-id').value = lot.id;
                fillLotEditCrops(lot.crop_type);
                document.getElementById('edit-lot-quality').value = lot.quality_grade || 'Grade 1 (Standard)';
                document.getElementById('edit-lot-quantity').value = lot.quantity;
                document.getElementById('edit-lot-harvest').value = lot.harvest_date || '';
                document.getElementById('edit-lot-origin').value = lot.hub_location || '';
                document.getElementById('edit-lot-target').value = lot.target_hub || '';
                lotEditModal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }));
            produceLotsTbody.querySelectorAll('.remove-lot').forEach(button => button.addEventListener('click', async () => {
                const lot = loadedLotsById.get(button.dataset.id);
                if (!lot || !window.confirm(`Remove unused lot ${lot.lot_ref || lot.id}? This cannot be undone.`)) return;
                button.disabled = true;
                try {
                    const response = await fetch(`/api/agent/produce-lots/${encodeURIComponent(lot.id)}`, {method:'DELETE'});
                    const result = await response.json();
                    if (!response.ok) throw new Error(result.error || 'Could not remove lot.');
                    showToast(result.message || 'Lot removed.');
                    fetchProduceLots();
                } catch (error) { showToast(error.message); button.disabled = false; }
            }));
        } catch (err) {
            console.error('Error fetching produce lots:', err);
        }
    }

    lotEditForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = lotEditForm.querySelector('button[type="submit"]');
        const lotId = document.getElementById('edit-lot-id').value;
        const payload = {
            crop_type: lotEditCrop.value,
            quality_grade: document.getElementById('edit-lot-quality').value,
            quantity: document.getElementById('edit-lot-quantity').value,
            harvest_date: document.getElementById('edit-lot-harvest').value,
            hub_location: document.getElementById('edit-lot-origin').value,
            target_hub: document.getElementById('edit-lot-target').value,
        };
        submit.disabled = true;
        try {
            const response = await fetch(`/api/agent/produce-lots/${encodeURIComponent(lotId)}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not save lot correction.');
            closeLotEditor();
            showToast(data.message || 'Lot correction saved.');
            fetchProduceLots();
        } catch (error) { showToast(error.message); }
        finally { submit.disabled = false; }
    });

    // 3. Fetch & Load Buyer Orders / Allocations
    async function fetchOrders() {
        if (!salesOrdersTbody) return;
        try {
            const res = await fetch('/api/buyer/orders');
            const data = await res.json();
            const orders = data.orders || [];

            if (orders.length === 0) {
                salesOrdersTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2.5rem 1rem; color:var(--muted);">
                            No buyer purchase orders placed yet. Active orders and lot allocations will appear here.
                        </td>
                    </tr>
                `;
                return;
            }

            salesOrdersTbody.innerHTML = '';
            orders.forEach((order) => {
                const tr = document.createElement('tr');
                const dateStr = order.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'Recent';

                tr.innerHTML = `
                    <td class="code-ref">${order.order_ref || '#ORD-' + (order.id || '000').toString().slice(-4)}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${order.buyer_name || 'Verified Buyer'}</div>
                        <div class="meta-sub">${order.hub_location || 'Aggregation Hub'}</div>
                    </td>
                    <td>
                        <div style="font-weight:600;">${order.crop_type}</div>
                        <div class="meta-sub">${order.quality_grade || 'Standard'}</div>
                    </td>
                    <td class="text-right" style="font-weight:700;">${order.quantity} Qtl</td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${Number(order.total_price || 0).toLocaleString()} ETB</td>
                    <td class="text-center">
                        <span class="badge badge-green">
                            <span class="badge-dot"></span> ${order.status || 'Confirmed'}
                        </span>
                    </td>
                    <td class="meta-sub">${dateStr}</td>
                `;
                salesOrdersTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error fetching orders:', err);
        }
    }

    async function fetchSupplyRequests() {
        if (!supplyRequestsTbody) return;
        try {
            const response = await fetch('/api/agent/supply-requests');
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Could not load supply requests.');
            const requests = data.requests || [];
            if (!requests.length) {
                supplyRequestsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:1.5rem;color:var(--muted);">No supply requests yet.</td></tr>';
                return;
            }
            supplyRequestsTbody.innerHTML = requests.map(item => {
                const shipments = item.shipments || [];
                const statuses = shipments.map(link => link.shipment?.status).filter(Boolean);
                const current = statuses.includes('Delivery Issue - Admin Review') ? 'Delivery Issue - Admin Review'
                    : statuses.includes('Awaiting Agent Approval') ? 'Awaiting Agent Approval'
                    : statuses.length && statuses.every(status => ['Agent Approved - Complete','Admin Resolved - Complete'].includes(status)) ? 'Agent Approved - Complete'
                    : statuses.length && statuses.every(status => status === 'Cancelled by Admin') ? 'Cancelled by Admin'
                    : statuses.length && statuses.every(status => ['Agent Approved - Complete','Admin Resolved - Complete','Cancelled by Admin'].includes(status)) ? 'Completed with cancellations'
                    : statuses.includes('In Transit') ? 'In Transit'
                    : statuses.includes('Loaded & Weighed') ? 'Loaded & Weighed'
                    : statuses.includes('Dispatched') ? 'Dispatched' : 'Ready for Carrier';
                const labels = {'Ready for Carrier':'Waiting for an approved vehicle','Dispatched':'Transporter assigned','Loaded & Weighed':'Loaded','In Transit':'In transit','Awaiting Agent Approval':'Awaiting delivery approval','Delivery Issue - Admin Review':'Admin reviewing issue','Agent Approved - Complete':'Delivered','Cancelled by Admin':'Cancelled by admin'};
                const status = labels[current] || current || item.status || 'Pending';
                const refs = shipments.map(link => link.shipment?.waybill_id).filter(Boolean);
                const carriers = [...new Set(shipments.map(link => link.shipment?.transporter_name || link.shipment?.vehicle_plate).filter(Boolean))];
                return `<tr><td>${item.created_at ? new Date(item.created_at).toLocaleDateString() : '?'}</td>
                    <td><strong>${escapeHtml(item.crop_type)}</strong><div class="meta-sub">${escapeHtml(item.quality_grade)}</div></td>
                    <td>${Number(item.quantity || 0).toLocaleString()} Qtl<div class="meta-sub">${shipments.length} trip(s)</div></td>
                    <td>${escapeHtml(item.source_hub)}</td>
                    <td>${escapeHtml(refs.join(', ') || 'Preparing waybill')}<div class="meta-sub">${escapeHtml(carriers.join(', '))}</div></td>
                    <td><span class="badge ${current === 'Agent Approved - Complete' ? 'badge-green' : current === 'Delivery Issue - Admin Review' || current === 'Cancelled by Admin' ? 'badge-amber' : 'badge-blue'}">${escapeHtml(status)}</span></td></tr>`;
            }).join('');
        } catch (error) {
            supplyRequestsTbody.innerHTML = `<tr><td colspan="6">${escapeHtml(error.message)}</td></tr>`;
        }
    }

    supplyForm?.addEventListener('submit', async event => {
        event.preventDefault();
        const button = document.getElementById('supply-request-submit');
        button.disabled = true;
        button.textContent = 'Checking nearby stock...';
        try {
            const response = await fetch('/api/agent/supply-requests', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    crop_type: supplyCrop.value,
                    quality_grade: document.getElementById('supply-quality').value,
                    quantity: document.getElementById('supply-quantity').value
                })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Could not place supply request.');
            showToast(result.message || 'Supply request placed.');
            supplyForm.reset();
            fetchSupplyRequests();
        } catch (error) { showToast(error.message); }
        finally { button.disabled = false; button.textContent = 'Request nearby supply'; }
    });

    async function fetchTransferApprovals() {
        if (!transferApprovalsTbody) return;
        try {
            const res = await fetch('/api/agent/transfer-approvals');
            const data = await res.json();
            const approvals = data.approvals || [];
            if (!approvals.length) {
                transferApprovalsTbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted);">No hub deliveries require your approval.</td></tr>';
                return;
            }
            transferApprovalsTbody.innerHTML = '';
            approvals.forEach(item => {
                const shipment = item.shipment || {};
                const tr = document.createElement('tr');
                const pending = item.status === 'pending';
                tr.innerHTML = `<td><strong>${escapeHtml(shipment.waybill_id || 'Transfer')}</strong><div class="meta-sub">${escapeHtml(shipment.origin_hub || '—')} → ${escapeHtml(shipment.destination_hub || '—')}</div></td>
                    <td>${escapeHtml(shipment.crop_type || 'Produce')} <div class="meta-sub">${escapeHtml(shipment.quality_grade || '')}</div></td>
                    <td>${Number(shipment.quantity || 0).toLocaleString()} Qtl</td>
                    <td>${item.requested_at ? new Date(item.requested_at).toLocaleString() : '—'}</td>
                    <td><span class="badge ${item.status === 'approved' ? 'badge-green' : item.status === 'rejected' ? 'badge-amber' : 'badge-blue'}">${escapeHtml(item.status)}</span>${item.reason ? `<div class="meta-sub">${escapeHtml(item.reason)}</div>` : ''}</td>
                    <td>${pending ? `<button class="btn btn-primary btn-sm approve-transfer" data-id="${item.id}">Approve</button> <button class="btn btn-ghost btn-sm reject-transfer" data-id="${item.id}">Report issue</button>` : 'Reviewed'}</td>`;
                transferApprovalsTbody.appendChild(tr);
            });
            transferApprovalsTbody.querySelectorAll('.approve-transfer,.reject-transfer').forEach(button => {
                button.addEventListener('click', async () => {
                    const approved = button.classList.contains('approve-transfer');
                    const reason = approved ? '' : window.prompt('Describe the delivery problem for the administrator:')?.trim();
                    if (!approved && !reason) return;
                    button.disabled = true;
                    try {
                        const response = await fetch('/api/agent/transfer-approval', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({approval_id:button.dataset.id,approved,reason})});
                        const result = await response.json();
                        if (!response.ok) throw new Error(result.error || 'Could not record your response.');
                        showToast(approved ? 'Delivery approval recorded.' : 'Issue reported to the administrator.');
                        fetchTransferApprovals();
                    } catch (error) { showToast(error.message); button.disabled = false; }
                });
            });
        } catch (err) { console.error('Failed to load delivery approvals:', err); }
    }

    // Farmer Search Filter
    if (farmerSearch) {
        farmerSearch.addEventListener('input', () => {
            const query = farmerSearch.value.toLowerCase().trim();
            if (!query) {
                renderFarmers(loadedFarmers);
                return;
            }
            const filtered = loadedFarmers.filter((f) => {
                const name = (f.full_name || '').toLowerCase();
                const kebele = (f.kebele_id || '').toLowerCase();
                const woreda = (f.woreda || '').toLowerCase();
                const coop = (f.cooperative || '').toLowerCase();
                const crop = (f.primary_crop || '').toLowerCase();
                return name.includes(query) || kebele.includes(query) || woreda.includes(query) || coop.includes(query) || crop.includes(query);
            });
            renderFarmers(filtered);
        });
    }

    // Initialize all data loaders
    loadCropPrices().finally(fetchProduceLots);
    fetchFarmers();
    fetchOrders();
    fetchTransferApprovals();
    fetchSupplyRequests();
    setInterval(fetchSupplyRequests, 30000);
});
