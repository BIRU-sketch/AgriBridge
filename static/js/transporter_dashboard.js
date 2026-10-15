document.addEventListener('DOMContentLoaded', () => {
    // Stepper elements
    const stepperFill = document.getElementById('stepper-fill');
    const stepItems = document.querySelectorAll('.step-item');
    const advanceStatusBtn = document.getElementById('advance-status-btn');
    const currentStatusText = document.getElementById('current-status-text');
    const activeRouteStatusBadge = document.getElementById('active-route-status-badge');
    const activeConsignmentsCount = document.getElementById('metric-active-consignments');
    const historyTbody = document.getElementById('completed-history-tbody');

    // Available loads buttons
    const acceptLoadBtns = document.querySelectorAll('.accept-load-btn');
    const availableLoadsCount = document.getElementById('metric-available-loads');

    // Vehicle modal elements
    const openVehicleBtns = document.querySelectorAll('[data-open-modal="vehicle-modal"]');
    const vehicleModal = document.getElementById('vehicle-modal');
    const closeVehicleBtns = document.querySelectorAll('[data-close-modal="vehicle-modal"]');
    const vehicleForm = document.getElementById('vehicle-form');
    const fleetGrid = document.getElementById('fleet-grid');
    const fleetCountEl = document.getElementById('metric-fleet-count');

    // Waybill modal elements
    const waybillModal = document.getElementById('waybill-modal');
    const closeWaybillBtns = document.querySelectorAll('[data-close-modal="waybill-modal"]');
    const printWaybillBtn = document.getElementById('print-waybill-btn');

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

    // Stepper State Machine
    const STAGES = [
        { name: 'Dispatched', width: '25%', btnText: 'Confirm Hub Arrival & Loading', statusBadge: 'Dispatched' },
        { name: 'Loaded & Weighed', width: '50%', btnText: 'Depart on Transit', statusBadge: 'Loaded' },
        { name: 'In Transit', width: '75%', btnText: 'Mark as Delivered & Offloaded', statusBadge: 'In Transit' },
        { name: 'Delivered & Offloaded', width: '100%', btnText: 'Trip Completed & Settled', statusBadge: 'Delivered' }
    ];

    let currentStageIndex = 2; // Default starting at 'In Transit'

    function updateStepperUI() {
        const stage = STAGES[currentStageIndex];
        if (stepperFill) stepperFill.style.width = stage.width;

        stepItems.forEach((item, idx) => {
            item.classList.remove('active', 'completed');
            if (idx < currentStageIndex) {
                item.classList.add('completed');
            } else if (idx === currentStageIndex) {
                item.classList.add('active');
            }
        });

        if (currentStatusText) currentStatusText.textContent = stage.name;
        if (activeRouteStatusBadge) activeRouteStatusBadge.textContent = stage.statusBadge;
        if (advanceStatusBtn) {
            if (currentStageIndex === STAGES.length - 1) {
                advanceStatusBtn.textContent = 'Trip Completed & Settled';
                advanceStatusBtn.disabled = true;
                advanceStatusBtn.classList.remove('btn-primary');
                advanceStatusBtn.classList.add('btn-ghost');
            } else {
                advanceStatusBtn.textContent = stage.btnText;
                advanceStatusBtn.disabled = false;
            }
        }
    }

    if (advanceStatusBtn) {
        advanceStatusBtn.addEventListener('click', async () => {
            if (currentStageIndex >= STAGES.length - 1) return;

            advanceStatusBtn.disabled = true;
            advanceStatusBtn.textContent = 'Updating Waybill…';

            const nextIndex = currentStageIndex + 1;
            const nextStage = STAGES[nextIndex];

            try {
                const res = await fetch('/api/shipment/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        waybill_id: 'WB-9042',
                        status: nextStage.name
                    })
                });

                const data = await res.json();
                currentStageIndex = nextIndex;
                updateStepperUI();
                showToast(data.message || `Status updated to ${nextStage.name}`);

                // If completed final delivery, append to completed distribution table
                if (currentStageIndex === STAGES.length - 1) {
                    if (activeConsignmentsCount) {
                        const count = parseInt(activeConsignmentsCount.textContent, 10) || 1;
                        activeConsignmentsCount.textContent = Math.max(0, count - 1).toString();
                    }

                    if (historyTbody) {
                        const tr = document.createElement('tr');
                        tr.innerHTML = `
                            <td class="code-ref">#WB-9042</td>
                            <td>
                                <div style="font-weight:700; color:var(--deep);">Humera Aggregation Hub ➔ Addis Central</div>
                                <div class="meta-sub">Sesame (Export Quality) &bull; Isuzu FSR</div>
                            </td>
                            <td class="text-right" style="font-weight:700;">120 Qtl</td>
                            <td class="text-right" style="font-weight:800; color:var(--brand);">22,000 ETB</td>
                            <td class="meta-sub">Today (Just now)</td>
                            <td class="text-center">
                                <span class="badge badge-green">
                                    <span class="badge-dot"></span>
                                    Verified &amp; Settled
                                </span>
                            </td>
                            <td class="text-right">
                                <button type="button" class="action-link view-waybill-btn"
                                    data-waybill="#WB-9042"
                                    data-route="Humera Hub ➔ Addis Central Warehouse"
                                    data-cargo="Sesame - Export Quality"
                                    data-tonnage="120 Quintals (12 MT)"
                                    data-tariff="22,000 ETB"
                                    data-vehicle="Isuzu FSR (ET-3-4521)"
                                    data-driver="Tariku F.">
                                    Digital Waybill
                                </button>
                            </td>
                        `;
                        historyTbody.prepend(tr);
                    }
                }
            } catch (err) {
                showToast(err.message || 'Error updating status');
                updateStepperUI();
            }
        });
    }

    // Accept Load Assignment
    acceptLoadBtns.forEach((btn) => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.load-card');
            const routeTitle = card?.querySelector('.load-route-title')?.textContent || 'Hub Consignment';
            const waybillId = `WB-${Math.floor(9050 + Math.random() * 50)}`;

            btn.disabled = true;
            btn.textContent = 'Claiming Load…';

            try {
                const res = await fetch('/api/shipment/claim', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        waybill_id: waybillId,
                        route: routeTitle,
                        vehicle_plate: 'ET-3-4521'
                    })
                });

                const data = await res.json();
                btn.textContent = '✓ Assigned & Active';
                btn.classList.remove('btn-outline');
                btn.classList.add('btn-primary');

                showToast(data.message || `Route assignment for ${routeTitle} accepted!`);

                if (availableLoadsCount) {
                    const current = parseInt(availableLoadsCount.textContent, 10) || 4;
                    availableLoadsCount.textContent = Math.max(0, current - 1).toString();
                }

                if (activeConsignmentsCount) {
                    const current = parseInt(activeConsignmentsCount.textContent, 10) || 1;
                    activeConsignmentsCount.textContent = (current + 1).toString();
                }
            } catch (err) {
                showToast(err.message || 'Error claiming load');
                btn.disabled = false;
                btn.textContent = 'Accept Route Assignment';
            }
        });
    });

    // Vehicle Modal Handling
    openVehicleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (vehicleModal) vehicleModal.classList.add('active');
        });
    });

    closeVehicleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (vehicleModal) vehicleModal.classList.remove('active');
        });
    });

    if (vehicleModal) {
        vehicleModal.addEventListener('click', (e) => {
            if (e.target === vehicleModal) vehicleModal.classList.remove('active');
        });
    }

    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const plate = document.getElementById('vehicle-plate')?.value.trim();
            const type = document.getElementById('vehicle-type')?.value;
            const capacity = document.getElementById('vehicle-capacity')?.value;
            const driver = document.getElementById('vehicle-driver')?.value.trim();
            const phone = document.getElementById('vehicle-phone')?.value.trim();

            if (!plate) {
                showToast('Please enter the vehicle plate number.');
                return;
            }

            const submitBtn = vehicleForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Registering…';
            }

            try {
                const res = await fetch('/api/vehicle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plate_number: plate,
                        vehicle_type: type,
                        capacity_quintals: capacity,
                        driver_name: driver,
                        phone_number: phone
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to register vehicle.');

                // Append vehicle card to fleet grid
                if (fleetGrid) {
                    const card = document.createElement('div');
                    card.className = 'vehicle-card';
                    card.innerHTML = `
                        <div class="vehicle-head">
                            <span class="vehicle-plate">${plate}</span>
                            <span class="badge badge-green">
                                <span class="badge-dot"></span>
                                Available at Hub
                            </span>
                        </div>
                        <div class="vehicle-meta">
                            <div><strong>${type}</strong> &bull; ${capacity} Qtl Capacity</div>
                            <div>Driver: ${driver || 'Primary Driver'} &bull; ${phone || 'Verified'}</div>
                        </div>
                    `;
                    fleetGrid.prepend(card);
                }

                if (fleetCountEl) {
                    const cur = parseInt(fleetCountEl.textContent, 10) || 3;
                    fleetCountEl.textContent = (cur + 1).toString();
                }

                showToast(data.message || 'Vehicle registered to fleet!');
                vehicleForm.reset();
                vehicleModal.classList.remove('active');
            } catch (err) {
                showToast(err.message);
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Register Vehicle';
                }
            }
        });
    }

    // Waybill Modal Handling
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-waybill-btn');
        if (!btn) return;

        const waybillId = btn.dataset.waybill || '#WB-9042';
        const route = btn.dataset.route || 'Regional Route';
        const cargo = btn.dataset.cargo || 'Agricultural Commodity';
        const tonnage = btn.dataset.tonnage || '100 Qtl';
        const tariff = btn.dataset.tariff || '18,500 ETB';
        const vehicle = btn.dataset.vehicle || 'Isuzu FSR';
        const driver = btn.dataset.driver || 'Assigned Driver';

        const refEl = document.getElementById('wb-modal-ref');
        const routeEl = document.getElementById('wb-modal-route');
        const cargoEl = document.getElementById('wb-modal-cargo');
        const tonnageEl = document.getElementById('wb-modal-tonnage');
        const tariffEl = document.getElementById('wb-modal-tariff');
        const vehicleEl = document.getElementById('wb-modal-vehicle');
        const driverEl = document.getElementById('wb-modal-driver');

        if (refEl) refEl.textContent = waybillId;
        if (routeEl) routeEl.textContent = route;
        if (cargoEl) cargoEl.textContent = cargo;
        if (tonnageEl) tonnageEl.textContent = tonnage;
        if (tariffEl) tariffEl.textContent = tariff;
        if (vehicleEl) vehicleEl.textContent = vehicle;
        if (driverEl) driverEl.textContent = driver;

        if (waybillModal) waybillModal.classList.add('active');
    });

    closeWaybillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (waybillModal) waybillModal.classList.remove('active');
        });
    });

    if (waybillModal) {
        waybillModal.addEventListener('click', (e) => {
            if (e.target === waybillModal) waybillModal.classList.remove('active');
        });
    }

    if (printWaybillBtn) {
        printWaybillBtn.addEventListener('click', () => {
            window.print();
        });
    }
});
