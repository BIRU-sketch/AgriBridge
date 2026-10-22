from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response
from supabase import create_client, Client
import os
import uuid
import datetime
from dotenv import load_dotenv

from backend.store import store

load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_current_user():
    """Helper to get user from Supabase access token cookie"""
    token = request.cookies.get('access_token')
    if not token:
        return None
    try:
        response = supabase.auth.get_user(token)
        return response.user if response else None
    except Exception:
        return None


# ----------------------------------------------------
# Page Routes
# ----------------------------------------------------
@app.route('/')
def home():
    return render_template('homepage.html')


@app.route('/auth')
def auth_page():
    return render_template('auth.html')


@app.route('/dashboard')
def dashboard():
    token = request.cookies.get('access_token')
    if not token:
        return redirect('/auth')

    user = get_current_user()
    if not user:
        res = make_response(redirect('/auth'))
        res.delete_cookie('access_token')
        return res

    role = user.user_metadata.get('role') if user else None
    user_name = user.user_metadata.get('full_name') if user else None

    if role == 'agent':
        return render_template('agent_dashboard.html', username=user_name)
    elif role == 'buyer':
        return render_template('buyer_dashboard.html', username=user_name)
    elif role == 'transporter':
        return render_template('transporter_dashboard.html', username=user_name)
    elif role == 'admin':
        return render_template('admin_dashboard.html', username=user_name)
    else:
        return render_template('dashboard.html', username=user_name)


@app.route('/logout')
def logout():
    res = make_response(redirect('/auth'))
    res.delete_cookie('access_token')
    return res


@app.route("/register-farmer")
def register_farmer():
    user = get_current_user()
    if not user:
        return redirect('/auth')
    role = user.user_metadata.get('role')
    if role not in ('agent', 'admin'):
        return redirect('/dashboard')
    return render_template("register-farmer.html")


@app.route("/add-produce-lot")
def add_produce_lot():
    user = get_current_user()
    if not user:
        return redirect('/auth')
    role = user.user_metadata.get('role')
    if role not in ('agent', 'admin'):
        return redirect('/dashboard')
    return render_template("add-produce-lot.html")


# ----------------------------------------------------
# Auth APIs
# ----------------------------------------------------
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name") or "New User"
    role = data.get("role") or "buyer"

    # Transporters are hired and provisioned directly by administration
    if role == 'transporter':
        return jsonify({
            "error": "Self-registration is not permitted for Transporters. Contracted fleet operators and drivers are provisioned directly by AgriBridge administration."
        }), 403

    try:
        response = supabase.auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": full_name,
                    "role": role
                }
            }
        })
        user_id = response.user.id if getattr(response, 'user', None) else f"usr-{str(uuid.uuid4().int)[:5]}"

        # Record profile in store for Admin Verification queue
        store.add_user_profile({
            "id": f"usr-{str(uuid.uuid4().int)[:4]}",
            "auth_user_id": user_id,
            "full_name": full_name,
            "company_name": f"{full_name} ({role.title()})",
            "email": email,
            "role": role,
            "license_ref": f"Permit #{str(uuid.uuid4().int)[:5]}",
            "verified": False
        })

        # Try inserting into Supabase profile tables if schema is created
        try:
            table_name = f"{role}s" if not role.endswith('s') else role
            supabase.table(table_name).insert({
                "auth_user_id": user_id,
                "full_name": full_name,
                "email": email,
                "verified": False
            }).execute()
        except Exception:
            pass

        return jsonify({"message": "Signup successful! You can now log in.", "user_id": user_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    try:
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        session = getattr(response, 'session', None)
        if not session or not session.access_token:
            return jsonify({"error": "Unable to start session. Please verify your email or credentials."}), 400
        access_token = session.access_token
        res = make_response(jsonify({"message": "Login successful!"}))
        res.set_cookie('access_token', access_token, httponly=True)
        return res, 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ----------------------------------------------------
# Farmers & Produce Lots APIs (Agent Terminal)
# ----------------------------------------------------
@app.route("/api/agent/farmers", methods=['GET'])
def api_get_agent_farmers():
    try:
        farmers = store.get_farmers()
        try:
            res = supabase.table('farmers').select('*').order('created_at', desc=True).execute()
            if res.data:
                farmers = res.data
        except Exception:
            pass
        return jsonify({"farmers": farmers}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/register-farmer", methods=['POST'])
def api_register_farmer():
    data = request.form if request.form else (request.get_json() or {})
    try:
        farmer_data = {
            "full_name": data.get("full_name"),
            "phone_number": data.get("phone_number"),
            "kebele_id": data.get("kebele_id"),
            "gender": data.get("gender", "male"),
            "region": data.get("region", "oromia"),
            "woreda": data.get("woreda", "Bishoftu / Ada'a"),
            "kebele": data.get("kebele", "Kebele 04 Rural"),
            "land_size_hectares": float(data.get("land_size_hectares", 1.0) or 1.0),
            "water_source": data.get("water_source", "rain_fed"),
            "harvests_per_year": int(data.get("harvests_per_year", 1) or 1),
            "primary_crop": data.get("primary_crop", "White Teff"),
            "cooperative": data.get("cooperative", "Ada'a Multi-Purpose Farmers Cooperative"),
            "payout_method": data.get("payout_method", "cbe_bank"),
            "account_number": data.get("account_number", "")
        }

        saved_farmer = store.add_farmer(farmer_data)

        try:
            db_payload = {k: v for k, v in farmer_data.items() if k not in ("id", "lot_ref", "farmer_name")}
            sb_res = supabase.table('farmers').insert(db_payload).execute()
            if sb_res.data and sb_res.data[0].get('id'):
                saved_farmer["id"] = sb_res.data[0]['id']
        except Exception:
            pass

        return jsonify({"message": "Farmer registered successfully!", "data": saved_farmer}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/farmer/<kebele_id>", methods=['GET'])
def get_farmer_by_kebele_id(kebele_id):
    try:
        farmer = None
        try:
            res = supabase.table('farmers').select('*').eq('kebele_id', kebele_id).execute()
            if res.data:
                farmer = res.data[0]
        except Exception:
            pass

        if not farmer:
            farmer = store.get_farmer_by_kebele(kebele_id)

        if farmer:
            return jsonify({"farmer": farmer}), 200
        else:
            return jsonify({"farmer": None}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/agent/produce-lots", methods=['GET'])
def api_get_agent_produce_lots():
    try:
        lots = store.get_produce_lots()
        try:
            res = supabase.table('produce_lots').select('*').order('created_at', desc=True).execute()
            if res.data:
                lots = res.data
        except Exception:
            pass
        return jsonify({"lots": lots}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/add-produce-lot", methods=['POST'])
def api_add_produce_lot():
    data = request.get_json() or {}
    try:
        price_val = 5000.0
        try:
            price_res = supabase.table('prices').select('*').eq('crop_type', data.get("crop_type")).execute()
            if price_res and price_res.data:
                price_val = float(price_res.data[0].get('indicative_rate_etb', 5000))
        except Exception:
            pass

        produce_lot_data = {
            "farmer_kebele_id": data.get("farmer_kebele_id"),
            "crop_type": data.get("crop_type"),
            "quality_grade": data.get("quality_grade") or "Grade 1 (Standard)",
            "quantity": float(data.get("quantity") or 0),
            "harvest_date": data.get("harvest_date") or datetime.date.today().isoformat(),
            "price_per_qtl": price_val,
            "status": "In Hub Silo"
        }

        saved_lot = store.add_produce_lot(produce_lot_data)

        try:
            db_payload = {k: v for k, v in produce_lot_data.items() if k not in ("id", "lot_ref", "farmer_name")}
            sb_res = supabase.table('produce_lots').insert(db_payload).execute()
            if sb_res.data and sb_res.data[0].get('id'):
                saved_lot["id"] = sb_res.data[0]['id']
        except Exception:
            pass

        return jsonify({"message": "Produce lot added successfully to hub silo!", "data": saved_lot}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ----------------------------------------------------
# Marketplace APIs (Search & Purchase Only)
# Buyers search & purchase stock. No posting demands.
# ----------------------------------------------------
@app.route("/api/marketplace/search", methods=['GET'])
def search_marketplace():
    crop_name = request.args.get("crop_name", "").strip()
    quality = request.args.get("quality", "").strip()

    if not crop_name:
        return jsonify({"error": "Crop name is required."}), 400

    clean_quality = quality if quality and quality.lower() not in ("all quality grades", "all", "") else None

    # Get from data store
    lots = store.get_produce_lots(crop_name, clean_quality)

    try:
        query = supabase.table('produce_lots').select('*').ilike('crop_type', f'%{crop_name}%').gt('quantity', 0)
        if clean_quality:
            query = query.eq('quality_grade', clean_quality)
        sb_lots = query.execute().data
        if sb_lots:
            lots = sb_lots
    except Exception:
        pass

    total_quantity = round(sum(float(lot.get('quantity') or 0) for lot in lots), 2)
    if total_quantity.is_integer():
        total_quantity = int(total_quantity)

    return jsonify({
        "crop_name": crop_name,
        "quality": quality,
        "quantity": total_quantity,
        "match_count": len(lots),
        "lots": lots
    }), 200


@app.route("/api/marketplace/purchase", methods=['POST'])
def purchase_marketplace_stock():
    data = request.get_json() or {}
    crop_name = str(data.get("crop_name", "")).strip()
    quality = str(data.get("quality", "")).strip()
    clean_quality = quality if quality and quality.lower() not in ("all quality grades", "all", "") else None

    try:
        requested_quantity = round(float(data.get("quantity")), 2)
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid purchase quantity."}), 400

    if not crop_name or requested_quantity <= 0:
        return jsonify({"error": "Crop name and a positive purchase quantity are required."}), 400

    user = get_current_user()
    buyer_id = user.id if user else "buyer-default"
    buyer_name = user.user_metadata.get('full_name') if user else "Verified Institutional Buyer"

    buyer_info = {
        "id": buyer_id,
        "name": buyer_name,
        "destination_hub": data.get("destination_hub") or "Addis Central Terminal"
    }

    try:
        sb_lots = []
        sb_total = 0.0
        try:
            query = supabase.table('produce_lots').select('*').ilike('crop_type', f'%{crop_name}%').gt('quantity', 0)
            if clean_quality:
                query = query.eq('quality_grade', clean_quality)
            sb_lots = query.execute().data or []
        except Exception:
            pass

        if sb_lots:
            sb_total = round(sum(float(l.get('quantity') or 0) for l in sb_lots), 2)
            if sb_total < requested_quantity:
                return jsonify({
                    "error": f"Insufficient stock. Requested {requested_quantity:g} Qtl, but only {sb_total:g} Qtl is available."
                }), 409

            # FIFO deduction on Supabase lots
            sorted_sb = sorted(sb_lots, key=lambda l: str(l.get('harvest_date') or '9999'))
            needed = requested_quantity
            for lot in sorted_sb:
                avail = float(lot.get('quantity') or 0)
                deduct = min(avail, needed)
                new_q = round(max(0.0, avail - deduct), 2)
                try:
                    supabase.table('produce_lots').update({'quantity': new_q}).eq('id', lot['id']).execute()
                except Exception:
                    pass
                needed = round(needed - deduct, 2)
                if needed <= 0:
                    break

            try:
                supabase.table('demands').insert({
                    "buyer_id": user.id if user else None,
                    "crop_type": crop_name,
                    "quality_grade": clean_quality or "Grade 1 (Standard)",
                    "quantity": requested_quantity,
                    "status": "confirmed_purchase"
                }).execute()
            except Exception:
                pass

        # Also update store to generate buyer order and transporter shipment
        try:
            result = store.purchase_stock(crop_name, clean_quality, requested_quantity, buyer_info)
            if sb_lots:
                result["remaining_stock"] = round(max(0.0, sb_total - requested_quantity), 2)
        except ValueError:
            rem_q = round(max(0.0, sb_total - requested_quantity), 2)
            result = {
                "remaining_stock": rem_q,
                "order": {
                    "order_ref": f"#ORD-{uuid.uuid4().hex[:6].upper()}",
                    "crop_type": crop_name,
                    "quantity": requested_quantity,
                    "total_price": round(requested_quantity * 11500, 2),
                    "status": "Confirmed"
                },
                "shipment": {
                    "waybill_id": f"WB-{uuid.uuid4().hex[:4].upper()}",
                    "crop_type": crop_name,
                    "quantity": requested_quantity,
                    "tariff_etb": round(requested_quantity * 140 + 4000, 2),
                    "status": "Ready for Carrier"
                }
            }

        return jsonify({
            "message": "Purchase request confirmed! Stock reserved and transport consignment generated.",
            "crop_name": crop_name,
            "quantity_purchased": requested_quantity,
            "remaining_stock": result["remaining_stock"],
            "order": result["order"],
            "shipment": result["shipment"]
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 409
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/buyer/orders", methods=['GET'])
def api_get_buyer_orders():
    user = get_current_user()
    buyer_id = user.id if user else None
    orders = store.get_orders(buyer_id)
    try:
        q = supabase.table('orders').select('*').order('created_at', desc=True)
        if buyer_id:
            q = q.eq('buyer_id', buyer_id)
        sb_orders = q.execute().data
        if sb_orders:
            orders = sb_orders
    except Exception:
        pass
    return jsonify({"orders": orders}), 200


# ----------------------------------------------------
# Logistics & Transporter APIs
# ----------------------------------------------------
@app.route("/api/transporter/fleet", methods=['GET'])
def api_get_transporter_fleet():
    vehicles = store.get_vehicles()
    try:
        res = supabase.table('vehicles').select('*').order('created_at', desc=True).execute()
        if res.data:
            vehicles = res.data
    except Exception:
        pass
    return jsonify({"vehicles": vehicles}), 200


@app.route("/api/vehicle", methods=['POST'])
def api_add_vehicle():
    user = get_current_user()
    data = request.get_json() or {}
    plate_number = str(data.get("plate_number", "")).strip()
    if not plate_number:
        return jsonify({"error": "Plate number is required."}), 400

    vehicle_data = {
        "transporter_id": user.id if user else None,
        "plate_number": plate_number,
        "vehicle_type": data.get("vehicle_type") or "Isuzu FSR",
        "capacity_quintals": float(data.get("capacity_quintals") or 100),
        "driver_name": data.get("driver_name") or "Primary Driver",
        "phone_number": data.get("phone_number") or ""
    }

    try:
        saved = store.add_vehicle(vehicle_data)
        try:
            db_payload = {k: v for k, v in vehicle_data.items() if k != "id"}
            supabase.table('vehicles').insert(db_payload).execute()
        except Exception:
            pass

        return jsonify({
            "message": f"Vehicle {plate_number} registered! Submitted for roadworthiness inspection. Awaiting admin approval before route dispatch.",
            "data": saved
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/transporter/available-loads", methods=['GET'])
def api_get_available_loads():
    shipments = store.get_available_shipments()
    try:
        res = supabase.table('shipments').select('*').eq('status', 'Ready for Carrier').execute()
        if res.data:
            shipments = res.data
    except Exception:
        pass
    return jsonify({"loads": shipments}), 200


@app.route("/api/transporter/active-shipment", methods=['GET'])
def api_get_active_shipment():
    shipment = store.get_active_shipment()
    return jsonify({"shipment": shipment}), 200


@app.route("/api/transporter/completed-history", methods=['GET'])
def api_get_completed_history():
    shipments = store.get_completed_shipments()
    return jsonify({"completed": shipments}), 200


@app.route("/api/shipment/claim", methods=['POST'])
def api_claim_shipment():
    user = get_current_user()
    data = request.get_json() or {}
    waybill_id = data.get("waybill_id")
    vehicle_plate = data.get("vehicle_plate") or "ET-3-4521"
    transporter_id = user.id if user else "transporter-default"
    transporter_name = user.user_metadata.get('full_name') if user else "Licensed Carrier"

    try:
        claimed = store.claim_shipment(waybill_id, transporter_id, transporter_name, vehicle_plate)
        try:
            supabase.table('shipments').update({
                "transporter_id": transporter_id,
                "transporter_name": transporter_name,
                "vehicle_plate": vehicle_plate,
                "status": "Dispatched",
                "stage_index": 1
            }).eq('waybill_id', claimed['waybill_id']).execute()
        except Exception:
            pass

        return jsonify({
            "message": f"Route assignment for Waybill #{claimed['waybill_id']} successfully claimed!",
            "shipment": claimed
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/shipment/update-status", methods=['POST'])
def api_update_shipment_status():
    data = request.get_json() or {}
    waybill_id = data.get("waybill_id")
    status = data.get("status") or "In Transit"
    stage_index = int(data.get("stage_index", 2))

    try:
        updated = store.update_shipment_status(waybill_id, status, stage_index)
        try:
            supabase.table('shipments').update({
                "status": updated["status"],
                "stage_index": updated["stage_index"]
            }).eq('waybill_id', updated['waybill_id']).execute()
        except Exception:
            pass

        return jsonify({
            "message": f"Waybill #{updated['waybill_id']} status updated to: {updated['status']}.",
            "shipment": updated
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ----------------------------------------------------
# Admin Oversight APIs
# ----------------------------------------------------
@app.route("/api/admin/pending-users", methods=['GET'])
def api_get_pending_users():
    users = store.get_pending_users()
    return jsonify({"users": users}), 200


@app.route("/api/admin/stats", methods=['GET'])
def api_get_admin_stats():
    stats = store.get_admin_stats()
    return jsonify({"stats": stats}), 200


@app.route("/api/admin/verify-user", methods=['POST'])
def api_verify_user():
    data = request.get_json() or {}
    user_id = data.get("user_id") or "usr-9921"
    role = data.get("role") or "agent"
    verified = bool(data.get("verified", True))

    updated = store.verify_user(user_id, verified)

    try:
        table = f"{role}s" if not role.endswith('s') else role
        supabase.table(table).update({'verified': verified}).eq('id', user_id).execute()
    except Exception:
        pass

    return jsonify({
        "message": f"User {user_id} ({role}) successfully {'verified' if verified else 'suspended'}.",
        "user": updated
    }), 200


@app.route("/api/admin/pending-vehicles", methods=['GET'])
def api_get_pending_vehicles():
    vehicles = store.get_pending_vehicles()
    return jsonify({"vehicles": vehicles}), 200


@app.route("/api/admin/verify-vehicle", methods=['POST'])
def api_verify_vehicle():
    data = request.get_json() or {}
    vehicle_id = data.get("vehicle_id")
    approved = bool(data.get("approved", True))

    try:
        updated = store.verify_vehicle(vehicle_id, approved)
        try:
            supabase.table('vehicles').update({
                'status': updated['status'],
                'approved': approved
            }).eq('plate_number', updated['plate_number']).execute()
        except Exception:
            pass

        status_str = "Approved for Hub Dispatch" if approved else "Rejected / Grounded"
        return jsonify({
            "message": f"Vehicle {updated.get('plate_number')} roadworthiness status updated: {status_str}.",
            "vehicle": updated
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/admin/provision-transporter", methods=['POST'])
def api_provision_transporter():
    data = request.get_json() or {}
    full_name = str(data.get("full_name", "")).strip()
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", "")).strip() or "transporter123"
    company_name = str(data.get("company_name", "")).strip() or f"{full_name} Logistics"
    license_ref = str(data.get("license_ref", "")).strip()

    if not full_name or not email:
        return jsonify({"error": "Full Name and official Email are required to provision a contracted transporter."}), 400

    try:
        auth_user_id = None
        try:
            res = supabase.auth.sign_up({
                "email": email,
                "password": password,
                "options": {
                    "data": {
                        "full_name": full_name,
                        "role": "transporter"
                    }
                }
            })
            if getattr(res, 'user', None):
                auth_user_id = res.user.id
        except Exception:
            pass

        transporter_record = store.provision_transporter({
            "auth_user_id": auth_user_id,
            "full_name": full_name,
            "company_name": company_name,
            "email": email,
            "license_ref": license_ref
        })

        return jsonify({
            "message": f"Contracted Transporter account for '{full_name}' provisioned successfully! Credentials active for login.",
            "transporter": transporter_record,
            "temporary_password": password
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == '__main__':
    app.run(port=3000, debug=True)
