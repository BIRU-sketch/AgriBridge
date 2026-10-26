document.addEventListener('DOMContentLoaded', () => {
    const STAGES = [
        { name: 'Dispatched', width: '25%', btnText: 'Confirm Hub Arrival & Loading', badge: 'Dispatched', badgeClass: 'badge-amber' },
        { name: 'Loaded & Weighed', width: '50%', btnText: 'Depart on Transit', badge: 'Loaded', badgeClass: 'badge-amber' },
        { name: 'In Transit', width: '75%', btnText: 'Mark as Delivered & Offloaded', badge: 'In Transit', badgeClass: 'badge-amber' },
        { name: 'Delivered & Offloaded', width: '100%', btnText: 'Trip Completed & Settled', badge: 'Delivered', badgeClass: 'badge-green' }
    ];

    const activeRouteSection = document.getElementById('active-route');
    const activeBanner = document.getElementById('active-route-banner');
    const activeRouteRef = document.getElementById('active-route-ref');
    const activeRouteTitle = document.getElementById('active-route-title');
    const activeRouteCargo = document.getElementById('active-route-cargo');
    const activeRouteVehicle = document.getElementById('active-route-vehicle');
    const statusBadge = document.getElementById('active-route-status-badge');
    const statusBadgeText = document.getElementById('active-route-status-text');
    const stepperFill = document.getElementById('stepper-fill');
    const stepItems = document.querySelectorAll('.step-item');
    const advanceStatusBtn = document.getElementById('advance-status-btn');
    const currentStatusText = document.getElementById('current-status-text');
    const currentStatusHint = document.getElementById('current-status-hint');
    const activeConsignmentsEl = document.getElementById('metric-active-consignments');
    const activeConsignmentsSub = document.getElementById('metric-active-sub');
    const availableLoadsEl = document.getElementById('metric-available-loads');
    const availableLoadsHeader = document.getElementById('available-loads-count');
    const fleetCountEl = document.getElementById('metric-fleet-count');
    const historyTbody = document.getElementById('completed-history-tbody');
    const fleetGrid = document.getElementById('fleet-grid');
    const vehicleForm = document.getElementById('vehicle-form');
    const vehicleModal = document.getElementById('vehicle-modal');
    const waybillModal = document.getElementById('waybill-modal');
    const toast = document.getElementById('toast-msg');

    let toastTimeout = null;
    let stageIndex = 2;
    let activeTrip = activeBanner ? readTripFromBanner(activeBanner) : null;
    const queuedTrips = [];
    let nextWaybillNumber = 9051 + Math.floor(Math.random() * 400);

    function readTripFromBanner(banner) {
        return {
            waybill: banner.dataset.waybill || 'WB-9042',
            from: banner.dataset.routeFrom || 'Humera Aggregation Hub',
            to: banner.dataset.routeTo || 'Addis Central Distribution Center',
            cargo: banner.dataset.cargo || 'Sesame - Export Quality',
            quantity: banner.dataset.quantity || '120',
            tonnage: banner.dataset.tonnage || '120 Quintals (12 MT)',
            tariff: banner.dataset.tariff || '22,000 ETB',
            vehicle: banner.dataset.vehicle || 'Isuzu FSR',
            plate: banner.dataset.plate || 'ET-3-4521',
            driver: banner.dataset.driver || 'Tariku F.'
        };
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function routeMarkup(from, to) {
        return `${escapeHtml(from)} <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg> ${escapeHtml(to)}`;
    }

    function showToast(msg) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 4200);
    }

    function setButtonLabel(btn, label) {
        if (!btn) return;
        const labelEl = btn.querySelector('.btn-label');
        if (labelEl) {
            labelEl.textContent = label;
        } else {
            btn.textContent = label;
        }
    }

    function setText(el, value) {
        if (el) el.textContent = String(value);
    }

    async function postJson(url, payload) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        let data = {};
        try {
            data = await res.json();
        } catch (parseError) {
            data = {};
        }

        if (!res.ok) {
            throw new Error(data.error || `Request failed (${res.status}).`);
        }
        return data;
    }

    // The backend keeps claimed waybills in memory across reloads, while the
    // number counter resets with the page. Retry with fresh numbers on conflict.
    async function claimRoute(payload) {
        let conflict = null;
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const waybillId = `WB-${nextWaybillNumber++}`;
            try {
                const data = await postJson('/api/shipment/claim', { ...payload, waybill_id: waybillId });
                return { data, waybillId };
            } catch (err) {
                if (/already been claimed/i.test(err.message)) {
                    conflict = err;
                    continue;
                }
                throw err;
            }
        }
        throw conflict || new Error('Unable to allocate a waybill number.');
    }

    function updateCounts() {
        const activeCount = (activeTrip ? 1 : 0) + queuedTrips.length;
        const availableCount = document.querySelectorAll('.load-card:not(.is-claimed)').length;
        const fleetCount = fleetGrid ? fleetGrid.querySelectorAll('.vehicle-card').length : 0;

        setText(activeConsignmentsEl, activeCount);
        setText(availableLoadsEl, availableCount);
        setText(availableLoadsHeader, availableCount);
        setText(fleetCountEl, fleetCount);

        if (activeConsignmentsSub) {
            if (queuedTrips.length > 0) {
                activeConsignmentsSub.textContent = `${queuedTrips.length} queued behind current trip`;
            } else if (activeCount > 0) {
                activeConsignmentsSub.textContent = 'In transit to destination';
            } else {
                activeConsignmentsSub.textContent = 'No active consignments';
            }
        }
    }

    function updateStepperUI() {
        if (!activeTrip) {
            if (stepperFill) stepperFill.style.width = '0%';
            stepItems.forEach((item) => item.classList.remove('active', 'completed'));
            setText(currentStatusText, 'No active route assignment');
            if (currentStatusHint) {
                currentStatusHint.textContent = 'Claim an available load below to start your next trip.';
            }
            setText(statusBadgeText, 'Idle');
            if (statusBadge) {
                statusBadge.className = 'badge badge-amber';
            }
            if (advanceStatusBtn) {
                advanceStatusBtn.disabled = true;
                advanceStatusBtn.classList.remove('btn-primary');
                advanceStatusBtn.classList.add('btn-ghost');
                setButtonLabel(advanceStatusBtn, 'No Active Assignment');
            }
            return;
        }

        const stage = STAGES[stageIndex];
        if (stepperFill) stepperFill.style.width = stage.width;

        stepItems.forEach((item, idx) => {
            item.classList.remove('active', 'completed');
            if (idx < stageIndex) {
                item.classList.add('completed');
            } else if (idx === stageIndex) {
                item.classList.add('active');
            }
        });

        setText(currentStatusText, stage.name);
        setText(statusBadgeText, stage.badge);
        if (statusBadge) {
            statusBadge.className = `badge ${stage.badgeClass}`;
        }

        if (currentStatusHint) {
            currentStatusHint.textContent = stageIndex === STAGES.length - 1
                ? 'This trip is complete. Your waybill has been added to the settled ledger.'
                : 'Update the progress below once arrival or offloading is completed.';
        }

        if (advanceStatusBtn) {
            const isComplete = stageIndex === STAGES.length - 1;
            advanceStatusBtn.disabled = isComplete;
            advanceStatusBtn.classList.toggle('btn-primary', !isComplete);
            advanceStatusBtn.classList.toggle('btn-ghost', isComplete);
            setButtonLabel(advanceStatusBtn, isComplete ? 'Trip Completed & Settled' : stage.btnText);
        }
    }

    function renderActiveTrip() {
        if (!activeBanner) return;

        if (!activeTrip) {
            setText(activeRouteRef, '—');
            if (activeRouteTitle) activeRouteTitle.textContent = 'No active route assignment';
            setText(activeRouteCargo, '—');
            setText(activeRouteVehicle, '—');
            activeBanner.dataset.waybill = '';
            activeBanner.dataset.routeFrom = '';
            activeBanner.dataset.routeTo = '';
            activeBanner.dataset.cargo = '';
            activeBanner.dataset.quantity = '';
            activeBanner.dataset.tonnage = '';
            activeBanner.dataset.tariff = '';
            activeBanner.dataset.vehicle = '';
            activeBanner.dataset.plate = '';
            activeBanner.dataset.driver = '';
            updateStepperUI();
            return;
        }

        setText(activeRouteRef, `#${activeTrip.waybill}`);
        if (activeRouteTitle) {
            activeRouteTitle.innerHTML = routeMarkup(activeTrip.from, activeTrip.to);
        }
        setText(activeRouteCargo, `${activeTrip.quantity} Quintals (${activeTrip.cargo})`);
        setText(activeRouteVehicle, `${activeTrip.vehicle} (${activeTrip.plate})`);

        activeBanner.dataset.waybill = activeTrip.waybill;
        activeBanner.dataset.routeFrom = activeTrip.from;
        activeBanner.dataset.routeTo = activeTrip.to;
        activeBanner.dataset.cargo = activeTrip.cargo;
        activeBanner.dataset.quantity = activeTrip.quantity;
        activeBanner.dataset.tonnage = activeTrip.tonnage;
        activeBanner.dataset.tariff = activeTrip.tariff;
        activeBanner.dataset.vehicle = activeTrip.vehicle;
        activeBanner.dataset.plate = activeTrip.plate;
        activeBanner.dataset.driver = activeTrip.driver;

        updateStepperUI();
    }

    function setVehicleStatus(plate, status) {
        if (!fleetGrid) return;
        const card = Array.from(fleetGrid.querySelectorAll('.vehicle-card')).find((item) => {
            return (item.dataset.plate || '').toUpperCase() === String(plate || '').toUpperCase();
        });
        if (!card) return;

        const isAvailable = status === 'available';
        card.dataset.status = isAvailable ? 'available' : 'on-route';

        const badge = card.querySelector('.badge');
        if (badge) {
            badge.className = `badge ${isAvailable ? 'badge-green' : 'badge-amber'}`;
            badge.innerHTML = `<span class="badge-dot"></span> ${isAvailable ? 'Available at Hub' : 'On Route'}`;
        }
    }

    function findAvailableVehicle() {
        if (!fleetGrid) return null;
        const card = Array.from(fleetGrid.querySelectorAll('.vehicle-card')).find((item) => {
            return (item.dataset.status || 'available') === 'available';
        });
        if (!card) return null;

        return {
            element: card,
            plate: card.dataset.plate || card.querySelector('.vehicle-plate')?.textContent.trim() || '',
            type: card.dataset.type || 'Commercial Truck',
            driver: card.dataset.driver || 'Assigned Driver'
        };
    }

    function addHistoryRow(trip) {
        if (!historyTbody || !trip) return;

        const ref = `#${trip.waybill}`;
        const alreadyLogged = Array.from(historyTbody.querySelectorAll('.code-ref'))
            .some((el) => el.textContent.trim() === ref);
        if (alreadyLogged) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="code-ref">${escapeHtml(ref)}</td>
            <td>
                <div class="route-inline">${routeMarkup(trip.from, trip.to)}</div>
                <div class="meta-sub">${escapeHtml(trip.cargo)} &bull; ${escapeHtml(trip.vehicle)}</div>
            </td>
            <td class="text-right" style="font-weight:700;">${escapeHtml(trip.quantity)} Qtl</td>
            <td class="text-right" style="font-weight:800; color:var(--brand);">${escapeHtml(trip.tariff)}</td>
            <td class="meta-sub">Today (Just now)</td>
            <td class="text-center">
                <span class="badge badge-green">
                    <span class="badge-dot"></span>
                    Verified &amp; Settled
                </span>
            </td>
            <td class="text-right">
                <button type="button" class="action-link view-waybill-btn"
                    data-waybill="${escapeHtml(ref)}"
                    data-route="${escapeHtml(trip.from)} ➔ ${escapeHtml(trip.to)}"
                    data-cargo="${escapeHtml(trip.cargo)}"
                    data-tonnage="${escapeHtml(trip.tonnage)}"
                    data-tariff="${escapeHtml(trip.tariff)}"
                    data-vehicle="${escapeHtml(trip.vehicle)} (${escapeHtml(trip.plate)})"
                    data-driver="${escapeHtml(trip.driver)}">
                    Digital Waybill
                </button>
            </td>
        `;
        historyTbody.prepend(tr);
    }

    function scrollToActiveRoute() {
        if (!activeRouteSection) return;
        activeRouteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '#active-route');
        }
    }

    function completeCurrentTrip() {
        if (!activeTrip) return;

        const completedTrip = activeTrip;
        addHistoryRow(completedTrip);
        setVehicleStatus(completedTrip.plate, 'available');

        if (queuedTrips.length > 0) {
            activeTrip = queuedTrips.shift();
            stageIndex = 0;
            renderActiveTrip();
            showToast(`Trip ${completedTrip.waybill} delivered. Now tracking ${activeTrip.waybill}.`);
        } else {
            activeTrip = null;
            renderActiveTrip();
            showToast(`Trip ${completedTrip.waybill} delivered, offloaded, and settled.`);
        }
        updateCounts();
    }

    // Initial UI state (fixes labels, badge dots and count formatting).
    renderActiveTrip();
    updateCounts();

    // Journey progress state machine.
    if (advanceStatusBtn) {
        advanceStatusBtn.addEventListener('click', async () => {
            if (!activeTrip || stageIndex >= STAGES.length - 1) return;

            const nextIndex = stageIndex + 1;
            const nextStage = STAGES[nextIndex];
            const originalLabel = advanceStatusBtn.querySelector('.btn-label')?.textContent || '';

            advanceStatusBtn.disabled = true;
            setButtonLabel(advanceStatusBtn, 'Updating Waybill…');

            try {
                const data = await postJson('/api/shipment/update-status', {
                    waybill_id: activeTrip.waybill,
                    status: nextStage.name
                });

                stageIndex = nextIndex;
                if (stageIndex === STAGES.length - 1) {
                    completeCurrentTrip();
                } else {
                    updateStepperUI();
                    showToast(data.message || `Status updated to ${nextStage.name}.`);
                }
            } catch (err) {
                setButtonLabel(advanceStatusBtn, originalLabel);
                updateStepperUI();
                showToast(err.message || 'Error updating waybill status.');
            }
        });
    }

    // Claim a route from the available loads pool.
    document.querySelectorAll('.accept-load-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const card = btn.closest('.load-card');
            if (!card || card.classList.contains('is-claimed')) return;

            const vehicle = findAvailableVehicle();
            if (!vehicle) {
                showToast('All registered trucks are on active routes. Register or release a vehicle first.');
                return;
            }

            const routeFrom = card.dataset.routeFrom || 'Collection Hub';
            const routeTo = card.dataset.routeTo || 'Regional Depot';
            const routeLabel = `${routeFrom} ➔ ${routeTo}`;

            btn.disabled = true;
            setButtonLabel(btn, 'Claiming Load…');

            try {
                const { data, waybillId: claimedId } = await claimRoute({
                    route: routeLabel,
                    vehicle_plate: vehicle.plate
                });

                const trip = {
                    waybill: data.waybill_id || claimedId,
                    from: routeFrom,
                    to: routeTo,
                    cargo: card.dataset.cargo || 'Agricultural Commodity',
                    quantity: card.dataset.quantity || '0',
                    tonnage: card.dataset.tonnage || `${card.dataset.quantity || '0'} Quintals`,
                    tariff: card.dataset.tariff || 'Pending tariff',
                    vehicle: vehicle.type,
                    plate: vehicle.plate,
                    driver: vehicle.driver
                };

                card.classList.add('is-claimed');
                btn.classList.remove('btn-outline');
                btn.classList.add('btn-primary');
                setButtonLabel(btn, '✓ Assigned');
                btn.disabled = true;

                setVehicleStatus(vehicle.plate, 'on-route');

                if (!activeTrip) {
                    activeTrip = trip;
                    stageIndex = 0;
                    renderActiveTrip();
                    updateCounts();
                    scrollToActiveRoute();
                    showToast(data.message || `Route ${trip.waybill} is now your active trip.`);
                } else {
                    queuedTrips.push(trip);
                    updateCounts();
                    showToast(`${data.message || 'Route claimed.'} Added to your assignment queue.`);
                }
            } catch (err) {
                btn.disabled = false;
                setButtonLabel(btn, 'Accept Route Assignment');
                showToast(err.message || 'Error claiming this route.');
            }
        });
    });

    // Modal helpers
    function openModal(modal) {
        if (!modal) return;
        modal.classList.add('active');
        document.body.classList.add('modal-open');
        const focusTarget = modal.querySelector('input, select, button:not([data-close-modal])');
        if (focusTarget) {
            setTimeout(() => focusTarget.focus(), 40);
        }
    }

    function closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        if (!document.querySelector('.modal-overlay.active')) {
            document.body.classList.remove('modal-open');
        }
    }

    document.querySelectorAll('[data-open-modal="vehicle-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => openModal(vehicleModal));
    });

    document.querySelectorAll('[data-close-modal="vehicle-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(vehicleModal));
    });

    document.querySelectorAll('[data-close-modal="waybill-modal"]').forEach((btn) => {
        btn.addEventListener('click', () => closeModal(waybillModal));
    });

    [vehicleModal, waybillModal].forEach((modal) => {
        if (!modal) return;
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal(modal);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        const openModalEl = document.querySelector('.modal-overlay.active');
        if (openModalEl) closeModal(openModalEl);
    });

    // Register a new vehicle.
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const plateInput = document.getElementById('vehicle-plate');
            const typeInput = document.getElementById('vehicle-type');
            const capacityInput = document.getElementById('vehicle-capacity');
            const driverInput = document.getElementById('vehicle-driver');
            const phoneInput = document.getElementById('vehicle-phone');
            const submitBtn = vehicleForm.querySelector('button[type="submit"]');

            const plate = (plateInput?.value || '').trim().toUpperCase();
            const type = typeInput?.value || 'Isuzu FSR Medium Truck';
            const capacity = Number(capacityInput?.value || 0);
            const driver = (driverInput?.value || '').trim();
            const phone = (phoneInput?.value || '').trim();

            if (!plate) {
                showToast('Please enter the vehicle plate number.');
                plateInput?.focus();
                return;
            }

            const existingPlates = Array.from(fleetGrid?.querySelectorAll('.vehicle-plate') || [])
                .map((el) => el.textContent.trim().toUpperCase());
            if (existingPlates.includes(plate)) {
                showToast(`Vehicle ${plate} is already registered in your fleet.`);
                plateInput?.focus();
                return;
            }

            if (!Number.isFinite(capacity) || capacity <= 0) {
                showToast('Enter a vehicle capacity greater than zero.');
                capacityInput?.focus();
                return;
            }

            submitBtn?.setAttribute('disabled', 'disabled');
            setButtonLabel(submitBtn, 'Registering…');

            try {
                const data = await postJson('/api/vehicle', {
                    plate_number: plate,
                    vehicle_type: type,
                    capacity_quintals: capacity,
                    driver_name: driver,
                    phone_number: phone
                });

                const vehicle = data.data || {};

                if (fleetGrid) {
                    const card = document.createElement('div');
                    card.className = 'vehicle-card';
                    card.dataset.plate = plate;
                    card.dataset.type = type;
                    card.dataset.capacity = String(capacity);
                    card.dataset.driver = driver || 'Primary Driver';
                    card.dataset.status = 'available';

                    const head = document.createElement('div');
                    head.className = 'vehicle-head';

                    const plateEl = document.createElement('span');
                    plateEl.className = 'vehicle-plate';
                    plateEl.textContent = plate;

                    const badge = document.createElement('span');
                    badge.className = 'badge badge-green';
                    badge.innerHTML = '<span class="badge-dot"></span> Available at Hub';

                    head.append(plateEl, badge);

                    const meta = document.createElement('div');
                    meta.className = 'vehicle-meta';

                    const spec = document.createElement('div');
                    const specStrong = document.createElement('strong');
                    specStrong.textContent = vehicle.vehicle_type || type;
                    spec.append(specStrong, document.createTextNode(` • ${vehicle.capacity_quintals || capacity} Qtl Capacity`));

                    const driverLine = document.createElement('div');
                    driverLine.textContent = `Driver: ${vehicle.driver_name || driver || 'Primary Driver'} • ${vehicle.phone_number || phone || 'Verified'}`;

                    meta.append(spec, driverLine);
                    card.append(head, meta);
                    fleetGrid.prepend(card);
                }

                updateCounts();
                showToast(data.message || 'Vehicle registered to fleet!');
                vehicleForm.reset();
                closeModal(vehicleModal);
            } catch (err) {
                showToast(err.message || 'Failed to register vehicle.');
            } finally {
                submitBtn?.removeAttribute('disabled');
                setButtonLabel(submitBtn, 'Register Vehicle');
            }
        });
    }

    // View / print a waybill.
    document.addEventListener('click', (event) => {
        const btn = event.target.closest('.view-waybill-btn');
        if (!btn) return;

        setText(document.getElementById('wb-modal-ref'), btn.dataset.waybill || '#WB-9042');
        setText(document.getElementById('wb-modal-route'), btn.dataset.route || 'Regional Route');
        setText(document.getElementById('wb-modal-cargo'), btn.dataset.cargo || 'Agricultural Commodity');
        setText(document.getElementById('wb-modal-tonnage'), btn.dataset.tonnage || '100 Qtl');
        setText(document.getElementById('wb-modal-tariff'), btn.dataset.tariff || '18,500 ETB');
        setText(document.getElementById('wb-modal-vehicle'), btn.dataset.vehicle || 'Isuzu FSR');
        setText(document.getElementById('wb-modal-driver'), btn.dataset.driver || 'Assigned Driver');

        openModal(waybillModal);
    });

    document.getElementById('print-waybill-btn')?.addEventListener('click', () => {
        window.print();
    });

    // Keep anchor navigation state in sync with the chosen section.
    const navLinks = Array.from(document.querySelectorAll('.dash-nav a[href^="#"]'));
    navLinks.forEach((link) => {
        link.addEventListener('click', () => {
            navLinks.forEach((other) => other.removeAttribute('aria-current'));
            link.setAttribute('aria-current', 'true');
        });
    });
});
