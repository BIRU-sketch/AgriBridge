document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const searchForm = document.getElementById('marketplace-search-form');
    const cropInput = document.getElementById('crop_name');
    const qualitySelect = document.getElementById('quality');
    const locationInput = document.getElementById('location');
    const resultsPanel = document.getElementById('search-results-panel');
    const resultCropTitle = document.getElementById('result-crop-title');
    const resultQualityBadge = document.getElementById('result-quality-badge');
    const resultStockNum = document.getElementById('result-stock-num');
    const resultPriceRate = document.getElementById('result-price-rate');
    const resultAlert = document.getElementById('result-alert');

    const purchaseForm = document.getElementById('purchase-form');
    const purchaseQuantity = document.getElementById('purchase-quantity');
    const purchaseEstTotal = document.getElementById('purchase-est-total');
    const purchaseSubmitBtn = document.getElementById('purchase-submit-btn');

    const quickChips = document.querySelectorAll('.chip[data-crop]');

    // Demand modal elements
    const openDemandBtns = document.querySelectorAll('[data-open-modal="post-demand-modal"]');
    const demandModal = document.getElementById('post-demand-modal');
    const closeDemandBtns = document.querySelectorAll('[data-close-modal="post-demand-modal"]');
    const demandForm = document.getElementById('post-demand-form');
    const pendingTbody = document.getElementById('pending-requests-tbody');
    const activeDemandsCountEl = document.getElementById('metric-active-demands');

    // Receipt modal elements
    const receiptModal = document.getElementById('receipt-modal');
    const closeReceiptBtns = document.querySelectorAll('[data-close-modal="receipt-modal"]');
    const receiptOrderRef = document.getElementById('receipt-order-ref');
    const receiptCrop = document.getElementById('receipt-crop');
    const receiptVolume = document.getElementById('receipt-volume');
    const receiptRate = document.getElementById('receipt-rate');
    const receiptTotal = document.getElementById('receipt-total');
    const receiptHub = document.getElementById('receipt-hub');
    const receiptDate = document.getElementById('receipt-date');

    // History filters
    const historySearchInput = document.getElementById('history-search-input');
    const historyHubSelect = document.getElementById('history-hub-select');
    const historyTbody = document.getElementById('trade-history-tbody');

    // Toast
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

    // Benchmark rates per Quintal in ETB
    const BENCHMARK_RATES = {
        'white teff': 11500,
        'teff': 11500,
        'bread wheat': 5200,
        'wheat': 5200,
        'yellow maize': 3750,
        'maize': 3750,
        'humera sesame': 16800,
        'sesame': 16800,
        'red kidney beans': 6800,
        'kidney beans': 6800,
        'malt barley': 6200,
        'barley': 6200,
        'coffee': 24000
    };

    function getBenchmarkRate(cropName) {
        if (!cropName) return 5000;
        const normalized = cropName.toLowerCase().trim();
        for (const [key, rate] of Object.entries(BENCHMARK_RATES)) {
            if (normalized.includes(key)) {
                return rate;
            }
        }
        return 4800; // default estimated rate
    }

    let currentSearch = null;

    // Quick filter chips click
    quickChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            quickChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            if (cropInput) {
                cropInput.value = chip.dataset.crop;
                searchForm?.requestSubmit();
            }
        });
    });

    // Marketplace Search Submit
    if (searchForm) {
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const cropName = cropInput?.value.trim() || '';
            const quality = qualitySelect?.value || '';

            if (!cropName) {
                showToast('Please enter a crop or commodity to search.');
                cropInput?.focus();
                return;
            }

            const searchBtn = searchForm.querySelector('button[type="submit"]');
            const originalBtnHtml = searchBtn?.innerHTML;
            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = `
                    <svg class="icon animate-spin" style="animation: spin 1s linear infinite; width:1.15rem;height:1.15rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke-width="4" stroke="currentColor" stroke-opacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" stroke-width="4" stroke="currentColor"></path>
                    </svg>
                    Searching Hubs…
                `;
            }

            try {
                const params = new URLSearchParams({
                    crop_name: cropName,
                    quality: quality
                });

                const res = await fetch(`${searchForm.action}?${params.toString()}`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to search stock.');
                }

                currentSearch = {
                    crop_name: data.crop_name,
                    quality: data.quality,
                    quantity: Number(data.quantity) || 0,
                    rate: getBenchmarkRate(data.crop_name)
                };

                // Display result card
                resultsPanel.classList.remove('hidden');
                resultCropTitle.textContent = currentSearch.crop_name;
                resultQualityBadge.textContent = quality ? quality.replace(/_/g, ' ') : 'All Quality Grades';
                resultStockNum.textContent = currentSearch.quantity.toLocaleString();
                resultPriceRate.textContent = `${currentSearch.rate.toLocaleString()} ETB`;

                if (currentSearch.quantity > 0) {
                    resultAlert.hidden = true;
                    purchaseForm.classList.remove('hidden');
                    purchaseQuantity.max = currentSearch.quantity;
                    purchaseQuantity.value = '';
                    updateCalculatedTotal(0);
                    showToast(`Found ${currentSearch.quantity} Qtl of ${currentSearch.crop_name} in stock.`);
                } else {
                    purchaseForm.classList.add('hidden');
                    resultAlert.hidden = false;
                    resultAlert.className = 'dash-alert dash-alert-error';
                    resultAlert.innerHTML = `
                        <span>Currently 0 Qtl available for "${currentSearch.crop_name}". You can publish a Custom Demand below to have regional agents aggregate harvest for you.</span>
                    `;
                }

                // Smooth scroll to results
                resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } catch (err) {
                resultsPanel.classList.remove('hidden');
                purchaseForm.classList.add('hidden');
                resultAlert.hidden = false;
                resultAlert.className = 'dash-alert dash-alert-error';
                resultAlert.textContent = err.message;
            } finally {
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = originalBtnHtml;
                }
            }
        });
    }

    // Dynamic price calculation on purchase quantity input
    function updateCalculatedTotal(qty) {
        if (!currentSearch || !purchaseEstTotal) return;
        const total = qty * currentSearch.rate;
        purchaseEstTotal.textContent = `${total.toLocaleString()} ETB`;
    }

    if (purchaseQuantity) {
        purchaseQuantity.addEventListener('input', () => {
            const val = parseFloat(purchaseQuantity.value) || 0;
            updateCalculatedTotal(val);
        });
    }

    // Purchase Form Submit
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!currentSearch || currentSearch.quantity <= 0) return;

            const qty = parseFloat(purchaseQuantity.value);
            if (!Number.isFinite(qty) || qty <= 0 || qty > currentSearch.quantity) {
                showToast(`Enter a purchase volume between 1 and ${currentSearch.quantity} Qtl.`);
                purchaseQuantity.focus();
                return;
            }

            const totalETB = (qty * currentSearch.rate).toLocaleString();
            const confirmMsg = `Confirm purchase order:\n\n• Commodity: ${currentSearch.crop_name}\n• Volume: ${qty} Qtl\n• Estimated Settlement: ${totalETB} ETB\n\nProceed with reservation?`;

            if (!window.confirm(confirmMsg)) {
                return;
            }

            if (purchaseSubmitBtn) {
                purchaseSubmitBtn.disabled = true;
                purchaseSubmitBtn.textContent = 'Processing Order…';
            }

            try {
                const response = await fetch('/api/marketplace/purchase', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crop_name: currentSearch.crop_name,
                        quality: currentSearch.quality,
                        quantity: qty
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to complete order.');
                }

                // Update remaining stock locally
                const remaining = data.remaining_stock;
                currentSearch.quantity = remaining;
                resultStockNum.textContent = remaining.toLocaleString();
                purchaseQuantity.max = remaining;
                purchaseQuantity.value = '';
                updateCalculatedTotal(0);

                if (remaining <= 0) {
                    purchaseForm.classList.add('hidden');
                }

                showToast(`Purchase confirmed: ${qty} Qtl ${currentSearch.crop_name} reserved!`);

                // Append new order to Trade History table
                addOrderToHistory({
                    orderId: `#TRD-${Math.floor(10000 + Math.random() * 90000)}`,
                    crop: currentSearch.crop_name,
                    hub: locationInput?.value || 'Bishoftu Hub',
                    volume: `${qty} Qtl`,
                    rate: `${currentSearch.rate.toLocaleString()} ETB`,
                    total: `${(qty * currentSearch.rate).toLocaleString()} ETB`,
                    date: 'Today (Just now)',
                    status: 'Processing Dispatch'
                });
            } catch (err) {
                showToast(err.message);
            } finally {
                if (purchaseSubmitBtn) {
                    purchaseSubmitBtn.disabled = false;
                    purchaseSubmitBtn.textContent = 'Confirm Purchase Order';
                }
            }
        });
    }

    // Helper: Add newly executed order to trade history table
    function addOrderToHistory(order) {
        if (!historyTbody) return;
        const tr = document.createElement('tr');
        tr.className = 'history-row';
        tr.dataset.hub = order.hub.toLowerCase();
        tr.dataset.search = `${order.orderId} ${order.crop}`.toLowerCase();
        tr.innerHTML = `
            <td class="code-ref">${order.orderId}</td>
            <td>
                <div style="font-weight:700; color:var(--deep);">${order.crop}</div>
                <div class="meta-sub">Direct Hub Reservation</div>
            </td>
            <td>${order.hub}</td>
            <td class="text-right" style="font-weight:700;">${order.volume}</td>
            <td class="text-right" style="color:var(--muted);">${order.rate}</td>
            <td class="text-right" style="font-weight:800; color:var(--brand);">${order.total}</td>
            <td class="meta-sub">${order.date}</td>
            <td class="text-center">
                <span class="badge badge-amber">
                    <span class="badge-dot"></span>
                    ${order.status}
                </span>
            </td>
            <td class="text-right">
                <button type="button" class="action-link view-receipt-btn"
                    data-order="${order.orderId}"
                    data-crop="${order.crop}"
                    data-hub="${order.hub}"
                    data-volume="${order.volume}"
                    data-rate="${order.rate}"
                    data-total="${order.total}"
                    data-date="${order.date}">
                    PDF Receipt
                </button>
            </td>
        `;
        historyTbody.prepend(tr);
    }

    // Modal controls for Demand Posting
    openDemandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (demandModal) demandModal.classList.add('active');
        });
    });

    closeDemandBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (demandModal) demandModal.classList.remove('active');
        });
    });

    if (demandModal) {
        demandModal.addEventListener('click', (e) => {
            if (e.target === demandModal) {
                demandModal.classList.remove('active');
            }
        });
    }

    // Demand Form Submit
    if (demandForm) {
        demandForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const crop = document.getElementById('demand-crop')?.value.trim();
            const quality = document.getElementById('demand-quality')?.value;
            const volume = parseFloat(document.getElementById('demand-volume')?.value);
            const hub = document.getElementById('demand-hub')?.value;
            const date = document.getElementById('demand-date')?.value;
            const maxPrice = document.getElementById('demand-price')?.value;

            if (!crop || !volume || volume <= 0) {
                showToast('Please specify commodity and valid volume.');
                return;
            }

            const submitBtn = demandForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Publishing Requirement…';
            }

            try {
                const res = await fetch('/api/demand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        crop_type: crop,
                        quality_grade: quality,
                        quantity: volume,
                        target_location: hub,
                        target_date: date,
                        max_price: maxPrice
                    })
                });

                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Failed to post demand.');
                }

                // Add to Pending Requests table
                const reqId = `#REQ-2026-${Math.floor(100 + Math.random() * 900)}`;
                if (pendingTbody) {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="code-ref">${reqId}</td>
                        <td>
                            <div style="font-weight:700; color:var(--deep);">${crop} (${quality})</div>
                            <div class="meta-sub">Institutional Buyer Requirement</div>
                        </td>
                        <td class="text-right" style="font-weight:700; color:var(--brand);">${volume} Qtl</td>
                        <td>${hub}</td>
                        <td class="meta-sub">${date || 'Flexible'}</td>
                        <td class="text-center">
                            <span class="badge badge-amber">
                                <span class="badge-dot"></span>
                                Agent Aggregating
                            </span>
                        </td>
                        <td class="text-right">
                            <button type="button" class="action-link" onclick="alert('Requirement details: ${reqId}')">Details</button>
                        </td>
                    `;
                    pendingTbody.prepend(tr);
                }

                if (activeDemandsCountEl) {
                    const current = parseInt(activeDemandsCountEl.textContent, 10) || 0;
                    activeDemandsCountEl.textContent = (current + 1).toString();
                }

                showToast(data.message || 'Procurement requirement posted!');
                demandForm.reset();
                demandModal.classList.remove('active');
            } catch (err) {
                showToast(err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Publish Requirement';
                }
            }
        });
    }

    // Trade History Live Search & Filter
    function filterHistoryTable() {
        const query = (historySearchInput?.value || '').toLowerCase().trim();
        const selectedHub = (historyHubSelect?.value || '').toLowerCase().trim();

        const rows = historyTbody?.querySelectorAll('.history-row');
        if (!rows) return;

        rows.forEach((row) => {
            const rowSearch = row.dataset.search || row.textContent.toLowerCase();
            const rowHub = row.dataset.hub || '';

            const matchesQuery = !query || rowSearch.includes(query);
            const matchesHub = !selectedHub || rowHub.includes(selectedHub);

            row.style.display = matchesQuery && matchesHub ? '' : 'none';
        });
    }

    if (historySearchInput) {
        historySearchInput.addEventListener('input', filterHistoryTable);
    }
    if (historyHubSelect) {
        historyHubSelect.addEventListener('change', filterHistoryTable);
    }

    // Receipt Modal Viewer
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-receipt-btn');
        if (!btn) return;

        if (receiptOrderRef) receiptOrderRef.textContent = btn.dataset.order || '#TRD-88201';
        if (receiptCrop) receiptCrop.textContent = btn.dataset.crop || 'Agricultural Produce';
        if (receiptVolume) receiptVolume.textContent = btn.dataset.volume || '100 Qtl';
        if (receiptRate) receiptRate.textContent = btn.dataset.rate || '11,500 ETB';
        if (receiptTotal) receiptTotal.textContent = btn.dataset.total || '1,150,000 ETB';
        if (receiptHub) receiptHub.textContent = btn.dataset.hub || 'Bishoftu Aggregation Hub';
        if (receiptDate) receiptDate.textContent = btn.dataset.date || 'Sept 04, 2026';

        if (receiptModal) receiptModal.classList.add('active');
    });

    closeReceiptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (receiptModal) receiptModal.classList.remove('active');
        });
    });

    if (receiptModal) {
        receiptModal.addEventListener('click', (e) => {
            if (e.target === receiptModal) receiptModal.classList.remove('active');
        });
    }

    const printReceiptBtn = document.getElementById('print-receipt-btn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', () => {
            window.print();
        });
    }
});
