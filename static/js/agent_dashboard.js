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
    const metricPayouts = document.getElementById('metric-payouts-settled');

    let loadedFarmers = [];

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
                const lotRef = lot.lot_ref || `#LOT-${(lot.id || '000').toString().slice(-4).toUpperCase()}`;

                tr.innerHTML = `
                    <td class="code-ref">${lotRef}</td>
                    <td class="code-ref">${lot.farmer_kebele_id || 'KBL-REG'}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${lot.crop_type || 'Commodity'}</div>
                        <div class="meta-sub">${lot.quality_grade || 'Standard Grade'}</div>
                    </td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${qty} Qtl</td>
                    <td class="meta-sub">${lot.harvest_date || 'Recent'}</td>
                    <td class="text-center">
                        <span class="badge ${isAvailable ? 'badge-green' : 'badge-amber'}">
                            <span class="badge-dot"></span> ${lot.status || (isAvailable ? 'In Hub Silo' : 'Dispatched')}
                        </span>
                    </td>
                    <td class="text-right">
                        <button type="button" class="action-link" onclick="alert('Grading certificate verified for ${lotRef} (${lot.crop_type})')">
                            Certificate
                        </button>
                    </td>
                `;
                produceLotsTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error fetching produce lots:', err);
        }
    }

    // 3. Fetch & Load Buyer Orders / Allocations
    async function fetchOrders() {
        if (!salesOrdersTbody) return;
        try {
            const res = await fetch('/api/buyer/orders');
            const data = await res.json();
            const orders = data.orders || [];

            let totalPayouts = 0;
            orders.forEach((o) => {
                totalPayouts += parseFloat(o.total_price || 0);
            });

            if (metricPayouts && totalPayouts > 0) {
                metricPayouts.textContent = `${Math.round(totalPayouts).toLocaleString()} ETB`;
            }

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
    fetchFarmers();
    fetchProduceLots();
    fetchOrders();
});
