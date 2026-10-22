import os
import json
import uuid
import datetime
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

load_dotenv()

STORE_FILE = os.path.join(os.path.dirname(__file__), "local_store.json")

# Initial realistic baseline seed data
DEFAULT_SEED = {
    "farmers": [
        {
            "id": "f-101",
            "full_name": "Ketema Bekele Tolossa",
            "phone_number": "0912345678",
            "kebele_id": "KBL-88204-BS",
            "gender": "male",
            "region": "oromia",
            "woreda": "Bishoftu / Ada'a",
            "kebele": "Kebele 04 Rural",
            "land_size_hectares": 4.5,
            "water_source": "irrigated",
            "harvests_per_year": 2,
            "primary_crop": "White Teff",
            "cooperative": "Ada'a Multi-Purpose Cooperative",
            "payout_method": "cbe_bank",
            "account_number": "1000293849201",
            "verified": True,
            "created_at": "2026-09-10T08:30:00Z"
        },
        {
            "id": "f-102",
            "full_name": "Derartu Tadesse Geda",
            "phone_number": "0923456789",
            "kebele_id": "KBL-77192-HT",
            "gender": "female",
            "region": "oromia",
            "woreda": "Asella / Hitosa",
            "kebele": "Kebele 02 Rural",
            "land_size_hectares": 6.0,
            "water_source": "rain_fed",
            "harvests_per_year": 1,
            "primary_crop": "Bread Wheat",
            "cooperative": "Hitosa Grain Union",
            "payout_method": "telebirr",
            "account_number": "0923456789",
            "verified": True,
            "created_at": "2026-09-12T10:15:00Z"
        },
        {
            "id": "f-103",
            "full_name": "Abebech Megersa Hunde",
            "phone_number": "0934567890",
            "kebele_id": "KBL-64019-GM",
            "gender": "female",
            "region": "oromia",
            "woreda": "Jimma / Gomma",
            "kebele": "Kebele 07",
            "land_size_hectares": 3.2,
            "water_source": "mixed",
            "harvests_per_year": 2,
            "primary_crop": "Specialty Arabica Coffee",
            "cooperative": "Gomma Coffee Union",
            "payout_method": "coop_bank",
            "account_number": "1029384756",
            "verified": True,
            "created_at": "2026-09-15T14:40:00Z"
        }
    ],
    "produce_lots": [
        {
            "id": "lot-201",
            "lot_ref": "#LOT-TF-904",
            "farmer_kebele_id": "KBL-88204-BS",
            "farmer_name": "Ketema Bekele Tolossa",
            "crop_type": "White Teff",
            "quality_grade": "Grade 1 (Standard)",
            "quantity": 850.0,
            "initial_quantity": 850.0,
            "hub_location": "Bishoftu Hub",
            "harvest_date": "2026-09-12",
            "price_per_qtl": 11500.0,
            "status": "In Hub Silo",
            "created_at": "2026-09-12T11:00:00Z"
        },
        {
            "id": "lot-202",
            "lot_ref": "#LOT-WH-410",
            "farmer_kebele_id": "KBL-77192-HT",
            "farmer_name": "Derartu Tadesse Geda",
            "crop_type": "Bread Wheat",
            "quality_grade": "Grade 1 (Standard)",
            "quantity": 1500.0,
            "initial_quantity": 1500.0,
            "hub_location": "Asella Hub",
            "harvest_date": "2026-09-05",
            "price_per_qtl": 5200.0,
            "status": "In Hub Silo",
            "created_at": "2026-09-05T09:20:00Z"
        },
        {
            "id": "lot-203",
            "lot_ref": "#LOT-SS-330",
            "farmer_kebele_id": "KBL-88204-BS",
            "farmer_name": "Ketema Bekele Tolossa",
            "crop_type": "Humera Sesame",
            "quality_grade": "Grade 1 (Export Spec)",
            "quantity": 420.0,
            "initial_quantity": 420.0,
            "hub_location": "Humera Hub",
            "harvest_date": "2026-09-01",
            "price_per_qtl": 16800.0,
            "status": "In Hub Silo",
            "created_at": "2026-09-01T15:00:00Z"
        },
        {
            "id": "lot-204",
            "lot_ref": "#LOT-MZ-512",
            "farmer_kebele_id": "KBL-77192-HT",
            "farmer_name": "Derartu Tadesse Geda",
            "crop_type": "Yellow Maize",
            "quality_grade": "Grade 2 (Commercial)",
            "quantity": 2400.0,
            "initial_quantity": 2400.0,
            "hub_location": "Bishoftu Hub",
            "harvest_date": "2026-09-14",
            "price_per_qtl": 3750.0,
            "status": "In Hub Silo",
            "created_at": "2026-09-14T08:10:00Z"
        },
        {
            "id": "lot-205",
            "lot_ref": "#LOT-CF-102",
            "farmer_kebele_id": "KBL-64019-GM",
            "farmer_name": "Abebech Megersa Hunde",
            "crop_type": "Coffee Arabica",
            "quality_grade": "Grade 1 (Export Spec)",
            "quantity": 180.0,
            "initial_quantity": 180.0,
            "hub_location": "Jimma Hub",
            "harvest_date": "2026-08-28",
            "price_per_qtl": 24000.0,
            "status": "In Hub Silo",
            "created_at": "2026-08-28T16:45:00Z"
        }
    ],
    "orders": [
        {
            "id": "ord-301",
            "order_ref": "#TRD-9041",
            "buyer_id": "buyer-default",
            "buyer_name": "Verified Institutional Buyer",
            "crop_type": "White Teff",
            "quality_grade": "Grade 1",
            "quantity": 200.0,
            "unit_price": 11500.0,
            "total_price": 2300000.0,
            "hub_location": "Bishoftu Hub",
            "status": "Confirmed & Dispatched",
            "created_at": "2026-09-18T10:00:00Z"
        },
        {
            "id": "ord-302",
            "order_ref": "#TRD-8972",
            "buyer_id": "buyer-default",
            "buyer_name": "Verified Institutional Buyer",
            "crop_type": "Bread Wheat",
            "quality_grade": "Grade 1",
            "quantity": 500.0,
            "unit_price": 5200.0,
            "total_price": 2600000.0,
            "hub_location": "Asella Hub",
            "status": "Confirmed & Dispatched",
            "created_at": "2026-09-15T12:30:00Z"
        }
    ],
    "shipments": [
        {
            "id": "shp-401",
            "waybill_id": "WB-9042",
            "order_ref": "#TRD-9041",
            "crop_type": "Humera Sesame",
            "quantity": 120.0,
            "origin_hub": "Humera Aggregation Hub",
            "destination_hub": "Addis Central Warehouse",
            "transporter_id": "transporter-default",
            "transporter_name": "Tariku F. Logistics",
            "vehicle_plate": "ET-3-4521",
            "tariff_etb": 22000.0,
            "status": "In Transit",
            "stage_index": 2,
            "claimed_at": "2026-09-18T07:00:00Z",
            "delivered_at": None,
            "created_at": "2026-09-18T06:30:00Z"
        },
        {
            "id": "shp-402",
            "waybill_id": "WB-9051",
            "order_ref": "#TRD-8972",
            "crop_type": "White Teff (Grade 1)",
            "quantity": 100.0,
            "origin_hub": "Bishoftu Cooperative Hub",
            "destination_hub": "Adama Food Processing Hub",
            "transporter_id": None,
            "transporter_name": None,
            "vehicle_plate": None,
            "tariff_etb": 18500.0,
            "status": "Ready for Carrier",
            "stage_index": 0,
            "claimed_at": None,
            "delivered_at": None,
            "created_at": "2026-09-19T09:00:00Z"
        },
        {
            "id": "shp-403",
            "waybill_id": "WB-9052",
            "order_ref": None,
            "crop_type": "Bread Wheat",
            "quantity": 150.0,
            "origin_hub": "Asella Central Depot",
            "destination_hub": "Bishoftu Millers Hub",
            "transporter_id": None,
            "transporter_name": None,
            "vehicle_plate": None,
            "tariff_etb": 16000.0,
            "status": "Ready for Carrier",
            "stage_index": 0,
            "claimed_at": None,
            "delivered_at": None,
            "created_at": "2026-09-19T10:15:00Z"
        }
    ],
    "vehicles": [
        {
            "id": "veh-501",
            "transporter_id": "transporter-default",
            "plate_number": "ET-3-4521",
            "vehicle_type": "Isuzu FSR (Medium Duty)",
            "capacity_quintals": 120.0,
            "driver_name": "Tariku Fikadu",
            "phone_number": "0911223344",
            "status": "On Trip (WB-9042)",
            "approved": True,
            "created_at": "2026-08-10T10:00:00Z"
        },
        {
            "id": "veh-502",
            "transporter_id": "transporter-default",
            "plate_number": "ET-3-7890",
            "vehicle_type": "Sino Heavy Duty Truck",
            "capacity_quintals": 400.0,
            "driver_name": "Alemu Worku",
            "phone_number": "0922334455",
            "status": "Available at Depot",
            "approved": True,
            "created_at": "2026-08-12T11:00:00Z"
        },
        {
            "id": "veh-503",
            "transporter_id": "transporter-default",
            "plate_number": "ET-3-1102",
            "vehicle_type": "Mitsubishi Canter",
            "capacity_quintals": 75.0,
            "driver_name": "Mussie Tefera",
            "phone_number": "0933445566",
            "status": "Pending Roadworthiness Approval",
            "approved": False,
            "created_at": "2026-09-18T09:30:00Z"
        }
    ],
    "users": [
        {
            "id": "usr-9921",
            "full_name": "Dawit Kebede",
            "company_name": "Ada'a Cooperative Union Agent",
            "email": "dawit.k@adaacoop.et",
            "role": "agent",
            "license_ref": "Coop Registry #CR-4410",
            "verified": False,
            "created_at": "2026-09-19T06:00:00Z"
        },
        {
            "id": "usr-9918",
            "full_name": "Yonas Mulugeta",
            "company_name": "Bole Food Processing Industries SC",
            "email": "procurement@bolefoods.et",
            "role": "buyer",
            "license_ref": "Ministry TIN #004928190",
            "verified": False,
            "created_at": "2026-09-18T18:00:00Z"
        },
        {
            "id": "usr-9912",
            "full_name": "Hailemariam Assefa",
            "company_name": "Abyssinia Trans-Regional Logistics PLC",
            "email": "fleet@abyssiniatrucks.et",
            "role": "transporter",
            "license_ref": "Transport Permit #TP-88402",
            "verified": False,
            "created_at": "2026-09-17T12:00:00Z"
        }
    ]
}


class DataStore:
    def __init__(self):
        self._ensure_store()

    def _ensure_store(self):
        if not os.path.exists(STORE_FILE):
            self._write_store(DEFAULT_SEED)

    def _read_store(self) -> Dict[str, Any]:
        self._ensure_store()
        try:
            with open(STORE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return DEFAULT_SEED

    def _write_store(self, data: Dict[str, Any]):
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # ----------------------------------------------------
    # Farmers
    # ----------------------------------------------------
    def get_farmers(self, kebele_id: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read_store()
        farmers = data.get("farmers", [])
        if kebele_id:
            return [f for f in farmers if f.get("kebele_id", "").strip().lower() == kebele_id.strip().lower()]
        return farmers

    def get_farmer_by_kebele(self, kebele_id: str) -> Optional[Dict[str, Any]]:
        farmers = self.get_farmers(kebele_id)
        return farmers[0] if farmers else None

    def add_farmer(self, farmer: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_store()
        farmer["id"] = farmer.get("id") or f"f-{uuid.uuid4().hex[:6]}"
        farmer["created_at"] = farmer.get("created_at") or datetime.datetime.now(datetime.timezone.utc).isoformat()
        farmer["verified"] = True
        data.setdefault("farmers", []).insert(0, farmer)
        self._write_store(data)
        return farmer

    # ----------------------------------------------------
    # Produce Lots
    # ----------------------------------------------------
    def get_produce_lots(self, crop_name: Optional[str] = None, quality: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read_store()
        lots = data.get("produce_lots", [])
        filtered = lots
        if crop_name:
            c_norm = crop_name.lower().strip()
            filtered = [l for l in filtered if c_norm in l.get("crop_type", "").lower()]
        if quality and quality.lower() not in ("all quality grades", "all", ""):
            q_norm = quality.lower().strip()
            filtered = [l for l in filtered if q_norm in l.get("quality_grade", "").lower()]
        return filtered

    def add_produce_lot(self, lot: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_store()
        lot["id"] = lot.get("id") or f"lot-{uuid.uuid4().hex[:6]}"
        if not lot.get("lot_ref"):
            prefix = "".join(w[0] for w in lot.get("crop_type", "PR").split()[:2]).upper()
            lot["lot_ref"] = f"#LOT-{prefix}-{str(uuid.uuid4().int)[:3]}"
        lot["status"] = lot.get("status") or "In Hub Silo"
        lot["hub_location"] = lot.get("hub_location") or "Bishoftu Hub"
        lot["initial_quantity"] = float(lot.get("quantity", 0))
        lot["quantity"] = float(lot.get("quantity", 0))
        lot["created_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Link farmer name if available
        farmer = self.get_farmer_by_kebele(lot.get("farmer_kebele_id", ""))
        if farmer:
            lot["farmer_name"] = farmer.get("full_name")

        data.setdefault("produce_lots", []).insert(0, lot)
        self._write_store(data)
        return lot

    def purchase_stock(self, crop_name: str, quality: Optional[str], requested_qty: float, buyer_info: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_store()
        lots = data.get("produce_lots", [])
        c_norm = crop_name.lower().strip()

        # Eligible lots
        matching_lots = [
            l for l in lots
            if c_norm in l.get("crop_type", "").lower() and float(l.get("quantity", 0)) > 0
        ]
        if quality and quality.lower() not in ("all quality grades", "all", ""):
            q_norm = quality.lower().strip()
            matching_lots = [l for l in matching_lots if q_norm in l.get("quality_grade", "").lower()]

        total_avail = sum(float(l.get("quantity", 0)) for l in matching_lots)
        if total_avail < requested_qty:
            raise ValueError(f"Insufficient stock. Requested {requested_qty:g} Qtl, but only {total_avail:g} Qtl is available.")

        # FIFO deduction by harvest date
        matching_lots.sort(key=lambda x: str(x.get("harvest_date", "9999-12-31")))
        remaining_to_deduct = requested_qty
        unit_price = 5000.0

        for lot in matching_lots:
            curr = float(lot.get("quantity", 0))
            if lot.get("price_per_qtl"):
                unit_price = float(lot["price_per_qtl"])
            deduct = min(curr, remaining_to_deduct)
            lot["quantity"] = round(curr - deduct, 2)
            if lot["quantity"] <= 0:
                lot["status"] = "Fully Dispatched"
            remaining_to_deduct = round(remaining_to_deduct - deduct, 2)
            if remaining_to_deduct <= 0:
                break

        # Calculate total price
        total_price = round(requested_qty * unit_price, 2)

        # 1. Create Order record
        order_ref = f"#TRD-{str(uuid.uuid4().int)[:5]}"
        new_order = {
            "id": f"ord-{uuid.uuid4().hex[:6]}",
            "order_ref": order_ref,
            "buyer_id": buyer_info.get("id", "buyer-default"),
            "buyer_name": buyer_info.get("name", "Verified Institutional Buyer"),
            "crop_type": crop_name,
            "quality_grade": quality or "Grade 1",
            "quantity": requested_qty,
            "unit_price": unit_price,
            "total_price": total_price,
            "hub_location": buyer_info.get("destination_hub") or "Bishoftu Hub",
            "status": "Confirmed & Ready for Transport",
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        data.setdefault("orders", []).insert(0, new_order)

        # 2. Automatically spawn Shipment / Waybill consignment for Transporters!
        waybill_id = f"WB-{str(uuid.uuid4().int)[:4]}"
        estimated_tariff = round(requested_qty * 140.0 + 4000.0, 2) # realistic ETB transport freight calculation
        new_shipment = {
            "id": f"shp-{uuid.uuid4().hex[:6]}",
            "waybill_id": waybill_id,
            "order_ref": order_ref,
            "crop_type": crop_name,
            "quantity": requested_qty,
            "origin_hub": "Bishoftu Aggregation Hub",
            "destination_hub": buyer_info.get("destination_hub") or "Addis Central Terminal",
            "transporter_id": None,
            "transporter_name": None,
            "vehicle_plate": None,
            "tariff_etb": estimated_tariff,
            "status": "Ready for Carrier",
            "stage_index": 0,
            "claimed_at": None,
            "delivered_at": None,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        data.setdefault("shipments", []).insert(0, new_shipment)

        self._write_store(data)

        # Recalculate remaining stock for this crop
        new_remaining = sum(
            float(l.get("quantity", 0)) for l in lots
            if c_norm in l.get("crop_type", "").lower()
        )

        return {
            "order": new_order,
            "shipment": new_shipment,
            "remaining_stock": round(new_remaining, 2)
        }

    # ----------------------------------------------------
    # Orders (Buyer History)
    # ----------------------------------------------------
    def get_orders(self, buyer_id: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read_store()
        orders = data.get("orders", [])
        if buyer_id:
            # return matches or all if dev default
            user_orders = [o for o in orders if o.get("buyer_id") == buyer_id]
            return user_orders if user_orders else orders
        return orders

    # ----------------------------------------------------
    # Shipments & Logistics (Transporter)
    # ----------------------------------------------------
    def get_available_shipments(self) -> List[Dict[str, Any]]:
        data = self._read_store()
        return [
            s for s in data.get("shipments", [])
            if s.get("status") == "Ready for Carrier" or s.get("transporter_id") is None
        ]

    def get_active_shipment(self, transporter_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        data = self._read_store()
        shipments = data.get("shipments", [])
        # Active are those claimed and stage < 4 (not delivered)
        for s in shipments:
            if s.get("status") in ("Dispatched", "Loaded & Weighed", "In Transit", "Assigned"):
                return s
        return None

    def get_completed_shipments(self) -> List[Dict[str, Any]]:
        data = self._read_store()
        return [
            s for s in data.get("shipments", [])
            if s.get("status") in ("Delivered & Offloaded", "Delivered & Settled", "Verified & Settled")
        ]

    def claim_shipment(self, waybill_id: str, transporter_id: str, transporter_name: str, vehicle_plate: str) -> Dict[str, Any]:
        data = self._read_store()
        shipments = data.get("shipments", [])
        target = next((s for s in shipments if s.get("waybill_id") == waybill_id), None)
        if not target:
            # If not found by exact ID, claim first available
            target = next((s for s in shipments if s.get("status") == "Ready for Carrier"), None)

        if not target:
            raise ValueError(f"No available consignment found for waybill {waybill_id}")

        target["transporter_id"] = transporter_id
        target["transporter_name"] = transporter_name
        target["vehicle_plate"] = vehicle_plate
        target["status"] = "Dispatched"
        target["stage_index"] = 1
        target["claimed_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()

        # Check vehicle approval
        vehicles = data.get("vehicles", [])
        assigned_vehicle = next((v for v in vehicles if v.get("plate_number") == vehicle_plate), None)
        if assigned_vehicle:
            if assigned_vehicle.get("status") == "Pending Roadworthiness Approval" or not assigned_vehicle.get("approved", True):
                raise ValueError(f"Vehicle {vehicle_plate} cannot be dispatched: Awaiting roadworthiness approval from administration.")
            assigned_vehicle["status"] = f"On Trip ({target.get('waybill_id')})"

        self._write_store(data)
        return target

    def update_shipment_status(self, waybill_id: str, new_status: str, stage_index: int) -> Dict[str, Any]:
        data = self._read_store()
        shipments = data.get("shipments", [])
        target = next((s for s in shipments if s.get("waybill_id") == waybill_id), None)
        if not target:
            # Try to find the active shipment
            for s in shipments:
                if s.get("status") in ("Dispatched", "Loaded & Weighed", "In Transit"):
                    target = s
                    break

        if not target:
            raise ValueError(f"Shipment {waybill_id} not found")

        target["status"] = new_status
        target["stage_index"] = stage_index
        if stage_index >= 4:
            target["delivered_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
            target["status"] = "Delivered & Settled"
            # Free up vehicle
            plate = target.get("vehicle_plate")
            if plate:
                for v in data.get("vehicles", []):
                    if v.get("plate_number") == plate:
                        v["status"] = "Available at Depot"

        self._write_store(data)
        return target

    # ----------------------------------------------------
    # Vehicles (Transporter Fleet)
    # ----------------------------------------------------
    def get_vehicles(self, transporter_id: Optional[str] = None) -> List[Dict[str, Any]]:
        data = self._read_store()
        vehicles = data.get("vehicles", [])
        if transporter_id:
            user_veh = [v for v in vehicles if v.get("transporter_id") == transporter_id]
            return user_veh if user_veh else vehicles
        return vehicles

    def add_vehicle(self, vehicle: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_store()
        vehicles = data.setdefault("vehicles", [])
        transporter_id = vehicle.get("transporter_id")

        # Limit to 5 registered vehicles maximum per transporter
        t_vehicles = [v for v in vehicles if v.get("transporter_id") == transporter_id] if transporter_id else vehicles
        if len(t_vehicles) >= 5:
            raise ValueError("Fleet capacity limit reached: A carrier can register a maximum of 5 vehicles. Contact administration for an authorized fleet expansion.")

        vehicle["id"] = vehicle.get("id") or f"veh-{uuid.uuid4().hex[:6]}"
        # Newly registered vehicle must wait for roadworthiness inspection & approval
        vehicle["status"] = "Pending Roadworthiness Approval"
        vehicle["approved"] = False
        vehicle["created_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        vehicles.append(vehicle)
        self._write_store(data)
        return vehicle

    def get_pending_vehicles(self) -> List[Dict[str, Any]]:
        data = self._read_store()
        return [
            v for v in data.get("vehicles", [])
            if v.get("status") == "Pending Roadworthiness Approval" or not v.get("approved", True)
        ]

    def verify_vehicle(self, vehicle_id: str, approved: bool = True) -> Dict[str, Any]:
        data = self._read_store()
        vehicles = data.get("vehicles", [])
        target = next((v for v in vehicles if v.get("id") == vehicle_id or v.get("plate_number") == vehicle_id), None)
        if not target:
            raise ValueError(f"Vehicle {vehicle_id} not found in fleet records")
        target["approved"] = approved
        target["status"] = "Available at Depot" if approved else "Inspection Rejected / Grounded"
        self._write_store(data)
        return target

    # ----------------------------------------------------
    # Users & Admin Verification
    # ----------------------------------------------------
    def add_user_profile(self, user: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_store()
        user["id"] = user.get("id") or f"usr-{str(uuid.uuid4().int)[:4]}"
        user["verified"] = user.get("verified", False)
        user["created_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        data.setdefault("users", []).insert(0, user)
        self._write_store(data)
        return user

    def provision_transporter(self, transporter_data: Dict[str, Any]) -> Dict[str, Any]:
        data = self._read_store()
        user_id = f"usr-{str(uuid.uuid4().int)[:4]}"
        new_user = {
            "id": user_id,
            "full_name": transporter_data.get("full_name"),
            "company_name": transporter_data.get("company_name") or f"{transporter_data.get('full_name')} Logistics",
            "email": transporter_data.get("email"),
            "role": "transporter",
            "license_ref": transporter_data.get("license_ref") or f"Transport Permit #TP-{str(uuid.uuid4().int)[:5]}",
            "verified": True,
            "provisioned_by_admin": True,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        data.setdefault("users", []).insert(0, new_user)
        self._write_store(data)
        return new_user

    def get_pending_users(self) -> List[Dict[str, Any]]:
        data = self._read_store()
        return [u for u in data.get("users", []) if not u.get("verified")]

    def get_all_users(self) -> List[Dict[str, Any]]:
        data = self._read_store()
        return data.get("users", [])

    def verify_user(self, user_id: str, verified: bool = True) -> Dict[str, Any]:
        data = self._read_store()
        users = data.get("users", [])
        target = next((u for u in users if u.get("id") == user_id), None)
        if target:
            target["verified"] = verified
        else:
            # Create a placeholder if not existing
            target = {
                "id": user_id,
                "full_name": f"User {user_id}",
                "role": "agent",
                "verified": verified
            }
            users.append(target)
        self._write_store(data)
        return target

    def get_admin_stats(self) -> Dict[str, Any]:
        data = self._read_store()
        total_users = len(data.get("users", [])) + 12
        pending_users = len([u for u in data.get("users", []) if not u.get("verified")])
        total_stock = sum(float(l.get("quantity", 0)) for l in data.get("produce_lots", []))
        total_trade = sum(float(o.get("total_price", 0)) for o in data.get("orders", [])) + 84500000.0

        return {
            "total_users": total_users,
            "pending_verifications": pending_users,
            "hub_buffer_stock": round(total_stock, 1),
            "total_trade_settled_etb": round(total_trade, 2)
        }


# Singleton instance
store = DataStore()
