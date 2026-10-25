document.addEventListener('DOMContentLoaded', () => {
    // Stepper elements
    const stepperFill = document.getElementById('stepper-fill');
    const stepItems = document.querySelectorAll('.step-item');
    const advanceStatusBtn = document.getElementById('advance-status-btn');
    const currentStatusText = document.getElementById('current-status-text');
    const activeRouteStatusBadge = document.getElementById('active-route-status-badge');
    const activeConsignmentsCount = document.getElementById('metric-active-consignments');
    const historyTbody = document.getElementById('completed-history-tbody');

    // Route summary elements
    const activeWaybillId = document.getElementById('active-waybill-id');
    const activeRouteTitle = document.getElementById('active-route-title');
    const activeAssignedCargo = document.getElementById('active-assigned-cargo');
    const activeAssignedVehicle = document.getElementById('active-assigned-vehicle');
    const activeRoutePanel = document.getElementById('active-route');

    // Available loads container
    const availableLoadsGrid = document.getElementById('available-loads-grid');
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

    // Stepper Stages:
    // 0: Ready for Carrier, 1: Dispatched, 2: Loaded & Weighed, 3: In Transit, 4: Delivered & Settled
    const STAGES = [
        { name: 'Ready for Carrier', width: '10%', btnText: 'Awaiting Driver Claim', statusBadge: 'Ready' },
        { name: 'Dispatched', width: '25%', btnText: 'Confirm Hub Arrival & Loading', statusBadge: 'Dispatched' },
        { name: 'Loaded & Weighed', width: '50%', btnText: 'Depart on Transit', statusBadge: 'Loaded' },
        { name: 'In Transit', width: '75%', btnText: 'Mark as Delivered & Offloaded', statusBadge: 'In Transit' },
        { name: 'Delivered & Offloaded', width: '100%', btnText: 'Trip Completed & Settled', statusBadge: 'Delivered' }
    ];

    let currentShipment = null;
    let availableVehicles = [];

    function updateStepperUI(stageIndex, shipment = currentShipment) {
        const stage = STAGES[stageIndex] || STAGES[1];
        if (stepperFill) stepperFill.style.width = stage.width;

        stepItems.forEach((item, idx) => {
            item.classList.remove('active', 'completed');
            // Stepper HTML has 4 visual steps representing stages 1, 2, 3, 4
            const visualStep = idx + 1;
            if (visualStep < stageIndex) {
                item.classList.add('completed');
            } else if (visualStep === stageIndex) {
                item.classList.add('active');
            }
        });

        const transferPending = stageIndex >= STAGES.length - 1 && ['hub_transfer', 'hub_supply'].includes(shipment?.shipment_type) && !['Agent Approved - Complete', 'Admin Resolved - Complete'].includes(shipment?.status);
        if (currentStatusText) currentStatusText.textContent = transferPending ? (shipment.status === 'Delivery Issue - Admin Review' ? 'Delivery issue reported to admin' : 'Awaiting agent approval') : stage.name;
        if (activeRouteStatusBadge) activeRouteStatusBadge.textContent = transferPending ? 'Approval Pending' : stage.statusBadge;

        if (advanceStatusBtn) {
            if (stageIndex >= STAGES.length - 1) {
                const waiting = ['hub_transfer', 'hub_supply'].includes(shipment?.shipment_type) && !['Agent Approved - Complete', 'Admin Resolved - Complete'].includes(shipment?.status);
                advanceStatusBtn.textContent = waiting ? (shipment.status === 'Delivery Issue - Admin Review' ? 'Delivery issue reported to admin' : 'Waiting for agent approvals') : (['hub_transfer', 'hub_supply'].includes(shipment?.shipment_type) ? 'Approved · Trip Complete' : 'Trip Completed & Settled');
                advanceStatusBtn.disabled = true;
                advanceStatusBtn.classList.remove('btn-primary');
                advanceStatusBtn.classList.add('btn-ghost');
            } else {
                advanceStatusBtn.textContent = stage.btnText;
                advanceStatusBtn.disabled = false;
                advanceStatusBtn.classList.remove('btn-ghost');
                advanceStatusBtn.classList.add('btn-primary');
            }
        }
    }

    // 1. Load Active Shipment
    async function loadActiveRoute() {
        try {
            const res = await fetch('/api/transporter/active-shipment');
            const data = await res.json();
            const shipment = data.shipment;
            const previousShipment = currentShipment;
            currentShipment = shipment;

            if (!shipment) {
                if (previousShipment) { loadCompletedHistory(); loadFleet(); }
                if (activeRoutePanel) activeRoutePanel.hidden = true;
                if (activeWaybillId) activeWaybillId.textContent = 'None';
                if (activeRouteTitle) activeRouteTitle.textContent = 'No Active Transport Assignment';
                if (activeAssignedCargo) activeAssignedCargo.innerHTML = '<strong>No cargo assigned</strong>';
                if (activeAssignedVehicle) activeAssignedVehicle.innerHTML = '<strong>Select vehicle from fleet</strong>';
                if (activeConsignmentsCount) activeConsignmentsCount.innerHTML = `0 <small style="font-size:.9rem;font-weight:600;">Trips</small>`;
                if (currentStatusText) currentStatusText.textContent = 'Ready for assignment';
                if (advanceStatusBtn) {
                    advanceStatusBtn.textContent = 'Claim Available Load Below';
                    advanceStatusBtn.disabled = true;
                }
                return;
            }

            if (activeRoutePanel) activeRoutePanel.hidden = false;
            if (!previousShipment || previousShipment.waybill_id !== shipment.waybill_id) loadFleet();
            if (activeWaybillId) activeWaybillId.textContent = `#${shipment.waybill_id}`;
            if (activeRouteTitle) activeRouteTitle.textContent = `${shipment.origin_hub} ➔ ${shipment.destination_hub}`;
            if (activeAssignedCargo) activeAssignedCargo.innerHTML = `<strong>${shipment.quantity} Qtl (${shipment.crop_type})</strong>`;
            if (activeAssignedVehicle) activeAssignedVehicle.innerHTML = `<strong>${shipment.vehicle_plate || 'Assigned Truck'}</strong>`;
            if (activeConsignmentsCount) activeConsignmentsCount.innerHTML = `1 <small style="font-size:.9rem;font-weight:600;">Trip</small>`;

            const stageIdx = Number(shipment.stage_index || 0);
            updateStepperUI(stageIdx, shipment);
        } catch (err) {
            console.error('Failed to load active route:', err);
        }
    }

    // Advance Status Button Click
    if (advanceStatusBtn) {
        advanceStatusBtn.addEventListener('click', async () => {
            if (!currentShipment) {
                showToast('No active consignment to update.');
                return;
            }

            const currentIdx = currentShipment.stage_index !== undefined ? currentShipment.stage_index : 2;
            if (currentIdx >= STAGES.length - 1) return;

            const nextIndex = currentIdx + 1;
            const nextStage = STAGES[nextIndex];

            advanceStatusBtn.disabled = true;
            advanceStatusBtn.textContent = 'Updating Waybill…';

            try {
                const res = await fetch('/api/shipment/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        waybill_id: currentShipment.waybill_id,
                        status: nextStage.name,
                        stage_index: nextIndex
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to update waybill status');

                currentShipment.stage_index = nextIndex;
                currentShipment.status = data.shipment?.status || nextStage.name;
                updateStepperUI(nextIndex, currentShipment);
                showToast(data.message || `Status updated to ${nextStage.name}`);

                // If final stage reached (Delivered & Settled)
                if (nextIndex >= STAGES.length - 1 && !['hub_transfer', 'hub_supply'].includes(currentShipment.shipment_type)) {
                    loadCompletedHistory();
                    setTimeout(() => {
                        loadActiveRoute();
                        loadAvailableLoads();
                    }, 1200);
                }
                if (nextIndex >= STAGES.length - 1 && ['hub_transfer', 'hub_supply'].includes(currentShipment.shipment_type)) {
                    loadActiveRoute();
                }
            } catch (err) {
                showToast(err.message || 'Error updating status');
                updateStepperUI(currentIdx);
            }
        });
    }

    // 2. Load Available Loads
    async function loadAvailableLoads() {
        if (!availableLoadsGrid) return;

        try {
            const res = await fetch('/api/transporter/available-loads');
            const data = await res.json();
            const loads = data.loads || [];

            if (availableLoadsCount) {
                availableLoadsCount.textContent = loads.length.toString();
            }

            if (loads.length === 0) {
                availableLoadsGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 2.5rem; text-align: center; color: var(--muted); background: var(--paper); border: 1.5px dashed var(--line); border-radius: 12px;">
                        No buyer loads are currently waiting for a carrier. Hub replenishment duties are assigned to your account automatically when an approved vehicle is available.
                    </div>
                `;
                return;
            }

            availableLoadsGrid.innerHTML = '';
            loads.forEach(load => {
                const card = document.createElement('div');
                card.className = 'load-card';
                card.innerHTML = `
                    <div>
                        <div class="load-card-head">
                        <span class="badge badge-green">${load.shipment_type === 'hub_transfer' ? 'Hub Transfer Offer' : 'Ready for Dispatch'}</span>
                            <span class="code-ref">#${load.waybill_id}</span>
                        </div>
                        <h3 class="load-route-title" style="margin-top:.75rem;">
                            ${load.origin_hub} ➔ ${load.destination_hub}
                        </h3>
                        <ul class="load-specs-list">
                            <li>
                                <span>Commodity:</span>
                                <strong>${load.crop_type} (${load.quantity} Qtl)</strong>
                            </li>
                            <li>
                                <span>Order Ref:</span>
                                <span>${load.shipment_type === 'hub_transfer' ? '100-Qtl Hub Transfer' : (load.order_ref || 'Buyer Order')}</span>
                            </li>
                            <li>
                                <span>Pickup Hub:</span>
                                <span>${load.origin_hub}</span>
                            </li>
                        </ul>
                    </div>
                    <div class="load-tariff">
                        <span class="meta-sub">Official Tariff:</span>
                        <span class="load-tariff-val">${load.tariff_etb == null ? 'Not set' : `${Number(load.tariff_etb).toLocaleString()} ETB`}</span>
                    </div>
                    <button type="button" class="btn btn-primary btn-block accept-load-btn" data-waybill="${load.waybill_id}">
                        Claim &amp; Assign Truck
                    </button>
                `;
                availableLoadsGrid.appendChild(card);
            });

            // Bind accept buttons
            availableLoadsGrid.querySelectorAll('.accept-load-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const waybillId = btn.dataset.waybill;
                    const selectedVehicle = availableVehicles.find(v => v.status === 'Approved for Hub Dispatch');
                    if (!selectedVehicle) {
                        showToast('Register a vehicle and wait for admin approval before claiming a load.');
                        return;
                    }
                    btn.disabled = true;
                    btn.textContent = 'Claiming Load…';

                    try {
                        const res = await fetch('/api/shipment/claim', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                waybill_id: waybillId,
                                vehicle_plate: selectedVehicle.plate_number
                            })
                        });

                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || 'Failed to claim consignment');

                        showToast(data.message || `Consignment #${waybillId} successfully claimed!`);
                        loadActiveRoute();
                        loadAvailableLoads();
                        loadFleet();
                    } catch (err) {
                        showToast(err.message || 'Error claiming consignment');
                        btn.disabled = false;
                        btn.textContent = 'Claim & Assign Truck';
                    }
                });
            });
        } catch (err) {
            console.error('Failed to load available loads:', err);
        }
    }

    // 3. Load Fleet
    async function loadFleet() {
        if (!fleetGrid) return;

        try {
            const res = await fetch('/api/transporter/fleet');
            const data = await res.json();
            const vehicles = data.vehicles || [];
            availableVehicles = vehicles;
            const registerVehBtn = document.getElementById('register-veh-btn');

            if (fleetCountEl) {
                fleetCountEl.innerHTML = `${vehicles.length} / 5 <small style="font-size:.9rem;font-weight:600;">Trucks</small>`;
            }

            // Enforce limit on frontend button
            if (registerVehBtn) {
                if (vehicles.length >= 5) {
                    registerVehBtn.disabled = true;
                    registerVehBtn.textContent = 'Quota Reached (Max 5)';
                    registerVehBtn.classList.remove('btn-primary');
                    registerVehBtn.classList.add('btn-ghost');
                } else {
                    registerVehBtn.disabled = false;
                    registerVehBtn.textContent = 'Register New Vehicle';
                    registerVehBtn.classList.remove('btn-ghost');
                    registerVehBtn.classList.add('btn-primary');
                }
            }

            if (vehicles.length === 0) {
                fleetGrid.innerHTML = `
                    <div style="grid-column: 1 / -1; padding: 2rem; text-align: center; color: var(--muted);">
                        No vehicles registered yet. Click "Register New Vehicle" above (Max 5).
                    </div>
                `;
                return;
            }

            fleetGrid.innerHTML = '';
            vehicles.forEach(veh => {
                const isApproved = veh.approved !== false && !veh.status?.includes('Pending');
                const isAvailable = isApproved && (veh.status?.includes('Available') || !veh.status);
                const isPending = !isApproved || veh.status?.includes('Pending');

                let badgeHtml = '';
                if (isPending) {
                    badgeHtml = `<span class="badge badge-amber"><span class="badge-dot"></span> Pending Approval</span>`;
                } else if (isAvailable) {
                    badgeHtml = `<span class="badge badge-green"><span class="badge-dot"></span> Available at Hub</span>`;
                } else {
                    badgeHtml = `<span class="badge badge-amber"><span class="badge-dot"></span> ${veh.status}</span>`;
                }

                const card = document.createElement('div');
                card.className = 'vehicle-card';
                card.innerHTML = `
                    <div class="vehicle-head">
                        <span class="vehicle-plate">${veh.plate_number}</span>
                        ${badgeHtml}
                    </div>
                    <div class="vehicle-meta">
                        <div><strong>${veh.vehicle_type}</strong> &bull; ${veh.capacity_quintals} Qtl Capacity</div>
                        <div>Driver: ${veh.driver_name || 'Assigned Driver'} &bull; Tel: ${veh.phone_number || '+251 91...'}</div>
                        ${isPending ? '<div style="font-size:.75rem; color:#B45309; margin-top:.25rem;">Awaiting administrative roadworthiness inspection before dispatch.</div>' : ''}
                    </div>
                `;
                fleetGrid.appendChild(card);
            });
        } catch (err) {
            console.error('Failed to load fleet:', err);
        }
    }

    // 4. Load Completed Distribution History
    async function loadCompletedHistory() {
        if (!historyTbody) return;

        try {
            const res = await fetch('/api/transporter/completed-history');
            const data = await res.json();
            const completed = data.completed || [];

            if (completed.length === 0) {
                historyTbody.innerHTML = `
                    <tr>
                        <td colspan="7" style="text-align:center; padding:2rem; color:var(--muted);">
                            No trips settled yet. Completed deliveries will be logged here.
                        </td>
                    </tr>
                `;
                return;
            }

            historyTbody.innerHTML = '';
            completed.forEach(shipment => {
                const tr = document.createElement('tr');
                const dateStr = shipment.delivered_at
                    ? new Date(shipment.delivered_at).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                    : 'Recent';

                tr.innerHTML = `
                    <td class="code-ref">#${shipment.waybill_id}</td>
                    <td>
                        <div style="font-weight:700; color:var(--deep);">${shipment.origin_hub} ➔ ${shipment.destination_hub}</div>
                        <div class="meta-sub">${shipment.crop_type} &bull; ${shipment.vehicle_plate || 'Freight'}</div>
                    </td>
                    <td class="text-right" style="font-weight:700;">${shipment.quantity} Qtl</td>
                    <td class="text-right" style="font-weight:800; color:var(--brand);">${shipment.tariff_etb == null ? 'Not set' : `${Number(shipment.tariff_etb).toLocaleString()} ETB`}</td>
                    <td class="meta-sub">${dateStr}</td>
                    <td class="text-center">
                        <span class="badge badge-green">
                            <span class="badge-dot"></span> ${shipment.status || 'Delivered & Offloaded'}
                        </span>
                    </td>
                    <td class="text-right">
                        <button type="button" class="action-link view-waybill-btn"
                            data-waybill="#${shipment.waybill_id}"
                            data-route="${shipment.origin_hub} ➔ ${shipment.destination_hub}"
                            data-cargo="${shipment.crop_type}"
                            data-tonnage="${shipment.quantity} Quintals"
                            data-tariff="${shipment.tariff_etb == null ? 'Not set' : `${Number(shipment.tariff_etb).toLocaleString()} ETB`}"
                            data-vehicle="${shipment.vehicle_plate || ''}"
                            data-driver="${shipment.transporter_name || ''}">
                            Digital Waybill
                        </button>
                    </td>
                `;
                historyTbody.appendChild(tr);
            });

            // Re-bind digital waybill modal
            historyTbody.querySelectorAll('.view-waybill-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const modal = document.getElementById('waybill-modal');
                    if (!modal) return;
                    document.getElementById('wb-modal-ref').textContent = btn.dataset.waybill;
                    document.getElementById('wb-modal-route').textContent = btn.dataset.route;
                    document.getElementById('wb-modal-cargo').textContent = btn.dataset.cargo;
                    document.getElementById('wb-modal-tonnage').textContent = btn.dataset.tonnage;
                    document.getElementById('wb-modal-tariff').textContent = btn.dataset.tariff;
                    document.getElementById('wb-modal-vehicle').textContent = btn.dataset.vehicle;
                    document.getElementById('wb-modal-driver').textContent = btn.dataset.driver;
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                });
            });
        } catch (err) {
            console.error('Failed to load completed history:', err);
        }
    }

    // Vehicle Modal Open/Close
    openVehicleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            vehicleModal?.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    closeVehicleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            vehicleModal?.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    // Vehicle Form Submit
    if (vehicleForm) {
        vehicleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = vehicleForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Registering Vehicle…';
            }

            const plate = vehicleForm.elements.namedItem('plate_number')?.value.trim();
            const type = vehicleForm.elements.namedItem('vehicle_type')?.value.trim();
            const cap = Number(vehicleForm.elements.namedItem('capacity_quintals')?.value);
            const driver = vehicleForm.elements.namedItem('driver_name')?.value.trim();
            const phone = vehicleForm.elements.namedItem('phone_number')?.value.trim();

            if (!plate || !type || !Number.isFinite(cap) || cap <= 0 || !driver || !phone) {
                showToast('Enter the plate, vehicle type, positive capacity, driver name, and phone number.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Register Vehicle';
                }
                return;
            }

            try {
                const res = await fetch('/api/vehicle', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        plate_number: plate,
                        vehicle_type: type,
                        capacity_quintals: cap,
                        driver_name: driver,
                        phone_number: phone
                    })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to register vehicle');

                vehicleModal?.classList.remove('active');
                document.body.style.overflow = '';
                vehicleForm.reset();
                showToast(`Vehicle ${plate} registered successfully!`);
                loadFleet();
            } catch (err) {
                showToast(err.message || 'Error registering vehicle');
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Register Vehicle in Fleet';
                }
            }
        });
    }

    // Waybill Modal Close
    closeWaybillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            waybillModal?.classList.remove('active');
            document.body.style.overflow = '';
        });
    });

    printWaybillBtn?.addEventListener('click', () => {
        window.print();
    });

    // Initial Execution
    loadActiveRoute();
    loadAvailableLoads();
    loadFleet();
    loadCompletedHistory();
    // Keep system-assigned replenishment duties visible while the dashboard is open.
    setInterval(loadActiveRoute, 15000);
    setInterval(loadAvailableLoads, 30000);
});
