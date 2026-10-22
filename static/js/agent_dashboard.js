document.addEventListener('DOMContentLoaded', () => {
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

    const metricFarmers = document.getElementById('metric-registered-farmers');
    const metricLots = document.getElementById('metric-active-lots');
    const metricVolume = document.getElementById('metric-aggregated-volume');

    // 1. Load Farmers Dynamically
    async function loadAgentFarmers() {
        if (!farmersTbody) return;

        try {
            const res = await fetch('/api/agent/farmers');
            const data = await res.json();
            const farmers = data.farmers || [];

            if (metricFarmers) {
                metricFarmers.innerHTML = `${farmers.length} <small style="font-size:.9rem;font-weight:600;">Farmers</small>`;
            }

            if (farmers.length === 0) {
                farmersTbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="text-align:center; padding:2rem; color:var(--muted);">
                            No smallholder farmers onboarded yet. Click "+ Onboard Farmer" to add.
                        </td>
                    </tr>
                `;
                return;
            }

            farmersTbody.innerHTML = '';
            farmers.forEach(farmer => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="code-ref">${farmer.kebele_id}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${farmer.full_name}</div>
                        <div class="meta-sub">${farmer.cooperative || 'Ada\'a Cooperative Union'}</div>
                    </td>
                    <td>${farmer.woreda || 'District'} &bull; ${farmer.kebele || 'Rural'}</td>
                    <td class="text-right" style="font-weight:700;">${farmer.land_size_hectares || 1.0} Ha</td>
                    <td>${farmer.primary_crop || 'Grain'}</td>
                    <td>${(farmer.payout_method || 'CBE').toUpperCase()}: ${farmer.account_number || 'Verified'}</td>
                    <td class="text-center">
                        <span class="badge badge-green">
                            <span class="badge-dot"></span> Verified
                        </span>
                    </td>
                    <td class="text-right">
                        <a href="/add-produce-lot?kebele_id=${encodeURIComponent(farmer.kebele_id)}" class="action-link">
                            + Add Harvest
                        </a>
                    </td>
                `;
                farmersTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Failed to load farmers:', err);
        }
    }

    // 2. Load Produce Lots Dynamically
    async function loadAgentProduceLots() {
        if (!produceLotsTbody) return;

        try {
            const res = await fetch('/api/agent/produce-lots');
            const data = await res.json();
            const lots = data.lots || [];

            let totalVolume = 0;
            lots.forEach(l => {
                totalVolume += parseFloat(l.quantity || 0);
            });

            if (metricLots) {
                metricLots.innerHTML = `${lots.length} <small style="font-size:.9rem;font-weight:600;">Lots</small>`;
            }
            if (metricVolume) {
                metricVolume.innerHTML = `${Math.round(totalVolume).toLocaleString()} <small style="font-size:.9rem;font-weight:600;">Qtl</small>`;
            }

            if (lots.length === 0) {
                produceLotsTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
                            No produce lots aggregated yet. Click "+ Add Produce Lot" to record harvest.
                        </td>
                    </tr>
                `;
                return;
            }

            produceLotsTbody.innerHTML = '';
            lots.forEach(lot => {
                const tr = document.createElement('tr');
                const qty = parseFloat(lot.quantity || 0);
                const isAvailable = qty > 0;

                tr.innerHTML = `
                    <td class="code-ref">${lot.lot_ref || '#LOT-001'}</td>
                    <td class="code-ref">${lot.farmer_kebele_id || 'KBL-88204-BS'}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${lot.crop_type} (${lot.quality_grade || 'Standard'})</div>
                        <div class="meta-sub">${lot.farmer_name ? 'Farmer: ' + lot.farmer_name : (lot.hub_location || 'Bishoftu Hub')}</div>
                    </td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${qty} Qtl</td>
                    <td class="meta-sub">${lot.harvest_date || 'Recent'}</td>
                    <td class="text-center">
                        <span class="badge ${isAvailable ? 'badge-green' : 'badge-amber'}">
                            <span class="badge-dot"></span> ${isAvailable ? 'In Hub Silo' : 'Dispatched'}
                        </span>
                    </td>
                    <td class="text-right">
                        <button type="button" class="action-link" onclick="alert('Viewing Quality Grade Certificate for ${lot.lot_ref || lot.crop_type}')">
                            Certificate
                        </button>
                    </td>
                `;
                produceLotsTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Failed to load produce lots:', err);
        }
    }

    // 3. Load Buyer Orders / Allocations
    async function loadSalesOrders() {
        if (!salesOrdersTbody) return;

        try {
            const res = await fetch('/api/buyer/orders');
            const data = await res.json();
            const orders = data.orders || [];

            if (orders.length === 0) {
                salesOrdersTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
                            No buyer purchases placed yet. Orders will appear here as soon as buyers reserve hub stock.
                        </td>
                    </tr>
                `;
                return;
            }

            salesOrdersTbody.innerHTML = '';
            orders.forEach(order => {
                const tr = document.createElement('tr');
                const dateStr = order.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'Recent';

                tr.innerHTML = `
                    <td class="code-ref">${order.order_ref}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${order.buyer_name || 'Verified Buyer'}</div>
                        <div class="meta-sub">${order.hub_location || 'Destination Terminal'}</div>
                    </td>
                    <td>
                        <div style="font-weight:600;">${order.crop_type}</div>
                        <div class="meta-sub">${order.quality_grade || 'Grade 1'}</div>
                    </td>
                    <td class="text-right" style="font-weight:700;">${order.quantity} Qtl</td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${Number(order.total_price).toLocaleString()} ETB</td>
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
            console.error('Failed to load sales orders:', err);
        }
    }

    // Filter Farmers Table
    if (farmerSearch && farmersTbody) {
        farmerSearch.addEventListener('input', () => {
            const query = farmerSearch.value.toLowerCase().trim();
            const rows = farmersTbody.querySelectorAll('tr');
            rows.forEach((row) => {
                const text = row.textContent.toLowerCase();
                row.style.display = !query || text.includes(query) ? '' : 'none';
            });
        });
    }

    // Initial Execution
    loadAgentFarmers();
    loadAgentProduceLots();
    loadSalesOrders();
});
