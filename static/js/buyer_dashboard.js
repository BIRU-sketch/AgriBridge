document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const buyerViewButtons = document.querySelectorAll('[data-buyer-view]');
    const buyerViewPanels = document.querySelectorAll('[data-buyer-panel]');
    const buyerViewTargets = document.querySelectorAll('[data-buyer-view-target]');
    const mainContent = document.getElementById('main');

    function showBuyerView(viewName, shouldScroll = true) {
        const targetPanel = document.querySelector(`[data-buyer-panel="${viewName}"]`);
        if (!targetPanel) return;
        buyerViewPanels.forEach(panel => { panel.hidden = panel !== targetPanel; });
        buyerViewButtons.forEach(button => {
            if (button.dataset.buyerView === viewName) button.setAttribute('aria-current', 'page');
            else button.removeAttribute('aria-current');
        });
        if (shouldScroll) mainContent?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    buyerViewButtons.forEach(button => {
        button.addEventListener('click', () => showBuyerView(button.dataset.buyerView));
    });
    buyerViewTargets.forEach(button => {
        button.addEventListener('click', () => showBuyerView(button.dataset.buyerViewTarget));
    });
    showBuyerView('browse', false);

    const searchForm = document.getElementById('marketplace-search-form');
    const cropInput = document.getElementById('crop_name');
    const qualitySelect = document.getElementById('quality');
    const locationInput = document.getElementById('location');
    const destinationHubInput = document.getElementById('destination-hub');
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
    const printReceiptBtn = document.getElementById('print-receipt-btn');

    // History filters & table
    const historySearchInput = document.getElementById('history-search-input');
    const historyHubSelect = document.getElementById('history-hub-select');
    const historyTbody = document.getElementById('trade-history-tbody');
    const totalOrdersCountEl = document.getElementById('metric-total-orders');
    const marketStockMetric = document.getElementById('metric-market-stock');

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
        }, 4500);
    }

    async function readApiResponse(response) {
        const body = await response.text();
        try {
            return JSON.parse(body);
        } catch {
            throw new Error(`The server returned an unexpected response (${response.status}). Please try again.`);
        }
    }

    let currentSearch = null;

    async function loadMarketplaceSummary() {
        if (!marketStockMetric) return;
        const selectedHub = locationInput?.value || '';
        if (locationInput) {
            locationInput.disabled = true;
            locationInput.innerHTML = '<option value="">Loading available hubs...</option>';
        }
        try {
            const response = await fetch('/api/marketplace/summary');
            const data = await readApiResponse(response);
            if (!response.ok) throw new Error(data.error || 'Could not load hub stock summary.');
            marketStockMetric.innerHTML = `${Number(data.available_quantity || 0).toLocaleString()} <small style="font-size:.9rem;font-weight:600;">Qtl</small>`;
            if (locationInput) {
                const hubs = data.hub_locations || [];
                locationInput.innerHTML = `<option value="">${hubs.length ? 'Choose a source hub' : 'No hubs with available stock'}</option>`;
                hubs.forEach(hub => {
                    const option = document.createElement('option');
                    option.value = hub;
                    option.textContent = hub;
                    locationInput.appendChild(option);
                });
                locationInput.disabled = hubs.length === 0;
                if ((data.hub_locations || []).includes(selectedHub)) locationInput.value = selectedHub;
            }
            if (historyHubSelect) {
                const selected = historyHubSelect.value;
                historyHubSelect.innerHTML = '<option value="">All Hubs</option>';
                (data.hub_locations || []).forEach(hub => {
                    const option = document.createElement('option');
                    option.value = hub.toLowerCase();
                    option.textContent = hub;
                    historyHubSelect.appendChild(option);
                });
                if ([...historyHubSelect.options].some(option => option.value === selected)) historyHubSelect.value = selected;
            }
        } catch (error) {
            marketStockMetric.textContent = 'Unavailable';
            if (locationInput) {
                locationInput.innerHTML = '<option value="">Could not load hubs</option>';
                locationInput.disabled = true;
            }
            showToast(error.message || 'Could not load available hubs. Refresh and try again.');
        }
    }

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
            if (!locationInput?.value) {
                showToast('Choose a source hub to search.');
                locationInput?.focus();
                return;
            }

            const searchBtn = searchForm.querySelector('button[type="submit"]');
            const originalBtnHtml = searchBtn?.innerHTML;
            if (searchBtn) {
                searchBtn.disabled = true;
                searchBtn.innerHTML = `
                    <svg class="icon animate-spin" style="animation: spin 1s linear infinite; width:1.15rem;height:1.15rem;" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke-width="3" stroke="currentColor" stroke-dasharray="32" stroke-linecap="round"/>
                    </svg>
                    Searching Silos…
                `;
            }

            try {
                const params = new URLSearchParams({
                    crop_name: cropName,
                    quality: quality,
                    hub_location: locationInput.value
                });

                const res = await fetch(`/api/marketplace/search?${params.toString()}`);
                const data = await readApiResponse(res);

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to search produce inventory.');
                }

                const cropTypes = data.crop_types || [];
                currentSearch = {
                    crop_name: cropTypes.length === 1 ? cropTypes[0] : data.crop_name,
                    crop_types: cropTypes,
                    quality: data.quality || '',
                    hub_location: data.hub_location,
                    quantity: data.quantity || 0,
                    rate: data.indicative_price_per_qtl == null ? null : Number(data.indicative_price_per_qtl)
                };

                // Display in Results Panel
                if (resultCropTitle) resultCropTitle.textContent = currentSearch.crop_name;
                if (resultQualityBadge) resultQualityBadge.textContent = currentSearch.quality || 'All Quality Grades';
                if (resultStockNum) resultStockNum.textContent = currentSearch.quantity.toLocaleString();
                if (resultPriceRate) resultPriceRate.textContent = currentSearch.rate == null ? 'See exact crop' : `${currentSearch.rate.toLocaleString()} ETB`;

                if (resultsPanel) {
                    resultsPanel.classList.remove('hidden');
                    resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }

                if (currentSearch.quantity <= 0) {
                    purchaseForm?.classList.add('hidden');
                    if (resultAlert) {
                        resultAlert.textContent = `No priced stock matched ${currentSearch.crop_name} at this hub. Try another hub or ask an agent to add a price to the available lot.`;
                        resultAlert.hidden = false;
                    }
                } else if (currentSearch.crop_types.length > 1) {
                    purchaseForm?.classList.add('hidden');
                    if (resultAlert) {
                        resultAlert.textContent = `This search matches ${currentSearch.crop_types.join(', ')}. Search for one exact crop before purchasing.`;
                        resultAlert.hidden = false;
                    }
                } else if (!currentSearch.quality) {
                    purchaseForm?.classList.add('hidden');
                    if (resultAlert) {
                        resultAlert.textContent = 'Choose a specific quality grade and search again. A single order cannot combine different grades.';
                        resultAlert.hidden = false;
                    }
                } else {
                    purchaseForm?.classList.remove('hidden');
                    if (purchaseQuantity) {
                        purchaseQuantity.max = currentSearch.quantity;
                        purchaseQuantity.value = '';
                    }
                    if (resultAlert) resultAlert.hidden = true;
                    updateCalculatedTotal(0);
                }

                showToast(`Search completed: ${currentSearch.quantity} Qtl of ${currentSearch.crop_name} available.`);
            } catch (err) {
                showToast(err.message || 'Error querying marketplace inventory.');
            } finally {
                if (searchBtn) {
                    searchBtn.disabled = false;
                    searchBtn.innerHTML = originalBtnHtml;
                }
            }
        });
    }

    // Purchase Quantity input update
    purchaseQuantity?.addEventListener('input', () => {
        const val = parseFloat(purchaseQuantity.value) || 0;
        updateCalculatedTotal(val);
    });

    function updateCalculatedTotal(qty) {
        if (!purchaseEstTotal || !currentSearch || currentSearch.rate == null) return;
        const total = Math.max(0, qty * currentSearch.rate);
        purchaseEstTotal.textContent = `${total.toLocaleString()} ETB`;
    }

    // Purchase Form Submit
    if (purchaseForm) {
        purchaseForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!currentSearch || currentSearch.quantity <= 0) return;

            const qty = parseFloat(purchaseQuantity.value);
            if (!Number.isFinite(qty) || qty <= 0 || qty > currentSearch.quantity) {
                showToast(`Enter a purchase volume greater than 0 and no more than ${currentSearch.quantity} Qtl.`);
                purchaseQuantity.focus();
                return;
            }

            const totalETB = (qty * currentSearch.rate).toLocaleString();
            const confirmMsg = `Confirm purchase order:\n\n• Commodity: ${currentSearch.crop_name}\n• Volume: ${qty} Qtl\n• Estimated Order Total: ${totalETB} ETB\n\nProceed with reservation?`;

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
                        hub_location: currentSearch.hub_location,
                        quantity: qty,
                        destination_hub: destinationHubInput?.value.trim()
                    })
                });

                const data = await readApiResponse(response);

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to complete order.');
                }

                // Update remaining stock locally
                const remaining = data.remaining_stock;
                currentSearch.quantity = remaining;
                if (resultStockNum) resultStockNum.textContent = remaining.toLocaleString();
                if (purchaseQuantity) {
                    purchaseQuantity.max = remaining;
                    purchaseQuantity.value = '';
                }
                updateCalculatedTotal(0);

                if (remaining <= 0) {
                    purchaseForm.classList.add('hidden');
                }

                const waybill = data.shipment?.waybill_id || 'Pending';
                showToast(`Purchase Confirmed! Waybill #${waybill} generated for transporter dispatch.`);

                // Reload real buyer orders
                loadBuyerOrders();

                // Open digital receipt for immediate review
                if (data.order) {
                    openReceiptModal({
                        orderId: data.order.order_ref,
                        crop: data.order.crop_type,
                        hub: data.order.hub_location,
                        volume: `${data.order.quantity} Qtl`,
                        rate: `${data.order.unit_price.toLocaleString()} ETB`,
                        total: `${data.order.total_price.toLocaleString()} ETB`,
                        date: new Date(data.order.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    });
                }
            } catch (err) {
                showToast(err.message || 'Error processing purchase order.');
            } finally {
                if (purchaseSubmitBtn) {
                    purchaseSubmitBtn.disabled = false;
                    purchaseSubmitBtn.textContent = 'Confirm Purchase Order';
                }
            }
        });
    }

    // Load Buyer Orders dynamically
    async function loadBuyerOrders() {
        if (!historyTbody) return;

        try {
            const res = await fetch('/api/buyer/orders');
            const data = await readApiResponse(res);
            const orders = data.orders || [];

            if (totalOrdersCountEl) {
                totalOrdersCountEl.textContent = orders.length.toString();
            }

            if (orders.length === 0) {
                historyTbody.innerHTML = `
                    <tr>
                        <td colspan="9" style="text-align:center; padding:2rem; color:var(--muted);">
                            No purchase orders executed yet. Search available produce stock above to purchase.
                        </td>
                    </tr>
                `;
                return;
            }

            historyTbody.innerHTML = '';
            orders.forEach(order => {
                const tr = document.createElement('tr');
                tr.className = 'history-row';
                tr.dataset.hub = (order.hub_location || '').toLowerCase();
                tr.dataset.search = `${order.order_ref} ${order.crop_type}`.toLowerCase();

                const dateStr = order.created_at
                    ? new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'Recent';

                tr.innerHTML = `
                    <td class="code-ref">${order.order_ref}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${order.crop_type}</div>
                        <div class="meta-sub">${order.quality_grade || 'Grade 1'}</div>
                    </td>
                    <td>${order.hub_location || 'Bishoftu Hub'}</td>
                    <td class="text-right" style="font-weight:700;">${order.quantity} Qtl</td>
                    <td class="text-right" style="color:var(--muted);">${Number(order.unit_price).toLocaleString()} ETB</td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${Number(order.total_price).toLocaleString()} ETB</td>
                    <td class="meta-sub">${dateStr}</td>
                    <td class="text-center">
                        <span class="badge badge-green">
                            <span class="badge-dot"></span>
                            ${order.status || 'Confirmed'}
                        </span>
                    </td>
                    <td class="text-right">
                        <button type="button" class="action-link view-receipt-btn"
                            data-order="${order.order_ref}"
                            data-crop="${order.crop_type}"
                            data-hub="${order.hub_location || 'Bishoftu Hub'}"
                            data-volume="${order.quantity} Qtl"
                            data-rate="${Number(order.unit_price).toLocaleString()} ETB"
                            data-total="${Number(order.total_price).toLocaleString()} ETB"
                            data-date="${dateStr}">
                            Receipt
                        </button>
                    </td>
                `;
                historyTbody.appendChild(tr);
            });

            // Re-bind receipt buttons
            historyTbody.querySelectorAll('.view-receipt-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    openReceiptModal({
                        orderId: btn.dataset.order,
                        crop: btn.dataset.crop,
                        hub: btn.dataset.hub,
                        volume: btn.dataset.volume,
                        rate: btn.dataset.rate,
                        total: btn.dataset.total,
                        date: btn.dataset.date
                    });
                });
            });
        } catch (err) {
            console.error('Failed to load buyer orders:', err);
        }
    }

    // Receipt Modal Opening
    function openReceiptModal(info) {
        if (!receiptModal) return;
        if (receiptOrderRef) receiptOrderRef.textContent = info.orderId;
        if (receiptCrop) receiptCrop.textContent = info.crop;
        if (receiptHub) receiptHub.textContent = info.hub;
        if (receiptVolume) receiptVolume.textContent = info.volume;
        if (receiptRate) receiptRate.textContent = info.rate;
        if (receiptTotal) receiptTotal.textContent = info.total;
        if (receiptDate) receiptDate.textContent = info.date;

        receiptModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    // Modal Close
    closeReceiptBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            receiptModal?.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    receiptModal?.addEventListener('click', (e) => {
        if (e.target === receiptModal) {
            receiptModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Print receipt
    printReceiptBtn?.addEventListener('click', () => {
        window.print();
    });

    // History filter & search
    function filterHistoryTable() {
        const query = historySearchInput?.value.toLowerCase().trim() || '';
        const hub = historyHubSelect?.value.toLowerCase().trim() || '';
        const rows = historyTbody?.querySelectorAll('.history-row') || [];

        rows.forEach((row) => {
            const matchesQuery = !query || row.dataset.search.includes(query);
            const matchesHub = !hub || row.dataset.hub.includes(hub);
            row.style.display = matchesQuery && matchesHub ? '' : 'none';
        });
    }

    historySearchInput?.addEventListener('input', filterHistoryTable);
    historyHubSelect?.addEventListener('change', filterHistoryTable);

    // Initial load
    loadBuyerOrders();
    loadMarketplaceSummary();
});
