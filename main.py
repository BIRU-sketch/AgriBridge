import hmac
import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response, session

try:
    from supabase import create_client, Client
except ImportError:  # Allows the app to boot far enough to show a configuration error.
    create_client = None
    Client = None

from dotenv import load_dotenv

# Load the .env that sits next to main.py, even when the app is started elsewhere.
load_dotenv(Path(__file__).resolve().parent / ".env")

# Dynamic in-memory catalog for fallback / dev mode
FALLBACK_CATALOG = {
    "white teff": 850.0,
    "teff": 850.0,
    "bread wheat": 1500.0,
    "wheat": 1500.0,
    "yellow maize": 2400.0,
    "maize": 2400.0,
    "humera sesame": 420.0,
    "sesame": 420.0,
    "malt barley": 600.0,
    "barley": 600.0,
    "red kidney beans": 350.0,
    "kidney beans": 350.0,
    "coffee arabica": 180.0,
    "coffee": 180.0
}

def normalize_crop_lookup(crop_name: str) -> str:
    norm = crop_name.lower().strip()
    for key in FALLBACK_CATALOG:
        if key in norm or norm in key:
            return key
    return norm

# ---------------------------------------------------------------------------
# Administrator verification queue (in-memory fallback + Supabase sync)
# ---------------------------------------------------------------------------
ADMIN_VERIFICATION_RECORDS = [
    {
        "id": "#USR-9921",
        "name": "Ada'a Cooperative Union Agent",
        "contact": "Dawit Kebede \u2022 dawit.k@adaacoop.et",
        "role": "agent",
        "role_label": "Extension Agent",
        "role_badge": "badge-green",
        "license": "Coop Registry #CR-4410",
        "registered": "Today (2 hrs ago)",
        "status": "pending",
    },
    {
        "id": "#USR-9918",
        "name": "Bole Food Processing Industries SC",
        "contact": "Yonas Mulugeta \u2022 procurement@bolefoods.et",
        "role": "buyer",
        "role_label": "Institutional Buyer",
        "role_badge": "badge-blue",
        "license": "Ministry TIN #004928190",
        "registered": "Yesterday",
        "status": "pending",
    },
    {
        "id": "#USR-9912",
        "name": "Abyssinia Trans-Regional Logistics PLC",
        "contact": "Hailemariam Assefa \u2022 fleet@abyssiniatrucks.et",
        "role": "transporter",
        "role_label": "Transporter Carrier",
        "role_badge": "badge-purple",
        "license": "Transport Permit #TP-88402",
        "registered": "2 days ago",
        "status": "pending",
    },
    {
        "id": "#USR-9904",
        "name": "Hitosa Farmers Cooperative Union",
        "contact": "Almaz Belay \u2022 contact@hitosacoop.et",
        "role": "agent",
        "role_label": "Extension Agent",
        "role_badge": "badge-green",
        "license": "Coop Registry #CR-3219",
        "registered": "3 days ago",
        "status": "verified",
    },
]
ADMIN_VERIFICATION_STATE = {}

# Transporter route assignments and shipment state for demo / disconnected mode.
CLAIMED_WAYBILLS = {}
SHIPMENT_STATUS = {}

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY") or os.urandom(32)
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.getenv("FLASK_SESSION_COOKIE_SECURE", "false").strip().lower()
    in {"1", "true", "yes", "on"},
    PERMANENT_SESSION_LIFETIME=timedelta(hours=12),
)


@app.after_request
def prevent_staff_page_caching(response):
    if request.path.startswith(("/admin", "/staff")):
        response.headers["Cache-Control"] = "no-store"
    return response


SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = None
if create_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception:
        # The UI still boots in demo mode when credentials are missing/invalid.
        supabase = None


def supabase_auth_configured() -> bool:
    """True only when real Supabase credentials are present (not placeholders)."""
    if supabase is None or not SUPABASE_URL or not SUPABASE_KEY:
        return False
    url = SUPABASE_URL.strip().lower()
    key = SUPABASE_KEY.strip().lower()
    if "your-project" in url or "example.supabase.co" in url:
        return False
    if not key or "your-" in key:
        return False
    return True


ROLE_DASHBOARD_ENDPOINTS = {
    "agent": "agent_dashboard_view",
    "buyer": "buyer_dashboard_view",
    "transporter": "transporter_dashboard_view",
    "admin": "admin_dashboard_view",
}


def get_staff_credentials():
    username = (os.getenv("INITIAL_ADMIN_USERNAME") or "").strip()
    password = os.getenv("INITIAL_ADMIN_PASSWORD") or ""
    return username, password


def get_staff_name(username: str) -> str:
    return (os.getenv("INITIAL_ADMIN_NAME") or "").strip() or username


class StaffUser:
    """Minimal user object for environment-configured staff sessions."""

    def __init__(self, username: str):
        self.id = f"staff:{username}"
        self.username = username
        self.user_metadata = {
            "role": "admin",
            "full_name": get_staff_name(username),
            "staff": True,
        }


def staff_credentials_match(identifier: str, password: str) -> bool:
    username, expected_password = get_staff_credentials()
    if not username or not expected_password or not identifier or not password:
        return False
    username_ok = hmac.compare_digest(
        identifier.strip().casefold(), username.casefold()
    )
    password_ok = hmac.compare_digest(password, expected_password)
    return username_ok and password_ok


def establish_staff_session():
    staff_username, _ = get_staff_credentials()
    session.clear()
    session.permanent = True
    session["staff_user"] = {"username": staff_username}


def safe_staff_next(target) -> str | None:
    """Return a safe internal staff path, rejecting external or unrelated URLs."""
    if not target:
        return None
    candidate = str(target).strip()
    parts = urlsplit(candidate)
    if parts.scheme or parts.netloc:
        return None
    path = parts.path
    if path != "/admin" and not path.startswith("/admin/"):
        return None
    return candidate


def get_current_user():
    """Resolve the signed-in staff member or Supabase user, or None."""
    staff_session = session.get("staff_user")
    if isinstance(staff_session, dict) and staff_session.get("username"):
        return StaffUser(staff_session["username"])

    token = request.cookies.get("access_token")
    if not token or supabase is None:
        return None
    try:
        response = supabase.auth.get_user(token)
        return getattr(response, "user", None)
    except Exception:
        return None


def get_user_role(user) -> str:
    metadata = getattr(user, "user_metadata", None) or {}
    return str(metadata.get("role") or "").strip().lower()


def get_user_name(user):
    metadata = getattr(user, "user_metadata", None) or {}
    return metadata.get("full_name")


def require_roles(*roles):
    """Return (user, None) for an allowed role, or (None, error_response)."""
    user = get_current_user()
    if user is None:
        return None, (jsonify({"error": "Sign in required."}), 401)
    role = get_user_role(user)
    if roles and role not in roles:
        return None, (jsonify({"error": "You do not have access to this action."}), 403)
    return user, None


def render_role_dashboard(role: str, template: str, **context):
    """Render a direct role route, redirecting guests or wrong-role visitors."""
    user = get_current_user()
    if user is None:
        # Staff pages use their own sign-in page, never the public login flow.
        if role == "admin":
            return redirect(url_for("staff_login_page", next=request.path))
        return redirect(url_for("auth_page"))

    actual_role = get_user_role(user)
    if actual_role != role:
        target = ROLE_DASHBOARD_ENDPOINTS.get(actual_role)
        if target:
            return redirect(url_for(target))
        return redirect(url_for("dashboard"))

    context.setdefault("username", get_user_name(user))
    return render_template(template, **context)


def get_verification_records():
    records = []
    for base_record in ADMIN_VERIFICATION_RECORDS:
        record = dict(base_record)
        if record["id"] in ADMIN_VERIFICATION_STATE:
            verified = ADMIN_VERIFICATION_STATE[record["id"]]
            record["status"] = "verified" if verified else "suspended"
        records.append(record)
    return records

@app.route('/')
def home():
    return render_template('homepage.html')
@app.route('/auth')
def auth_page():
    user = get_current_user()
    if user is not None:
        return redirect(url_for('dashboard'))
    return render_template('auth.html')


@app.route('/staff_login')
def staff_login_page():
    """Dedicated staff sign-in. It is intentionally not linked from public pages."""
    user = get_current_user()
    if user is not None:
        role = get_user_role(user)
        if role == "admin":
            return redirect(
                safe_staff_next(request.args.get("next"))
                or url_for("admin_dashboard_view")
            )
        endpoint = ROLE_DASHBOARD_ENDPOINTS.get(role)
        return redirect(url_for(endpoint) if endpoint else url_for("dashboard"))

    requested = safe_staff_next(request.args.get("next"))
    return render_template('staff_login.html', next=requested or '')


@app.route('/staff_login.html')
def staff_login_html_alias():
    """Allow the page to be reached by its filename as well as /staff_login."""
    return staff_login_page()


@app.route('/staff/login')
def staff_auth_page():
    requested = safe_staff_next(request.args.get('next'))
    if requested:
        return redirect(url_for('staff_login_page', next=requested))
    return redirect(url_for('staff_login_page'))


@app.route('/staff')
def staff_entry():
    return redirect(url_for('staff_login_page'))


@app.route('/api/signup', methods=['POST'])
def api_signup():
    if not supabase_auth_configured():
        return jsonify({"error": "Authentication is not configured. Add SUPABASE_URL and SUPABASE_KEY to the environment."}), 503
    data = request.get_json() or {}
    try:
        response = supabase.auth.sign_up({
            "email": data.get("email"),
            "password": data.get("password"),
            "options": {
                "data": {"full_name": data.get("full_name"),
                         "role": data.get("role")
                         }
            }
        })
        user_id = response.user.id if getattr(response, 'user', None) else None
        return jsonify({"message": "Signup successful!", "user_id": user_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/login', methods=['POST'])
def api_login():
    """Public email/password sign-in for agents, buyers, and transporters."""
    data = request.get_json(silent=True) or {}
    identifier = str(data.get("email") or "").strip()
    password = str(data.get("password") or "")

    if not identifier or not password:
        return jsonify({"error": "Enter your email and password."}), 400

    # Staff credentials are only valid on the dedicated staff endpoint.
    if staff_credentials_match(identifier, password):
        return jsonify({"error": "Incorrect email or password."}), 401

    if not supabase_auth_configured():
        return jsonify({
            "error": "Email and password sign-in is not configured on this server."
        }), 503

    try:
        response = supabase.auth.sign_in_with_password({
            "email": identifier,
            "password": password
        })
        auth_session = getattr(response, 'session', None)
        if not auth_session or not auth_session.access_token:
            return jsonify({"error": "Unable to start session. Please verify your email or credentials."}), 400
        access_token = auth_session.access_token
        user = getattr(response, 'user', None)
        role = get_user_role(user)
        redirect_url = url_for(ROLE_DASHBOARD_ENDPOINTS.get(role, 'dashboard'))
        session.pop('staff_user', None)
        res = make_response(jsonify({
            "message": "Login successful!",
            "redirect": redirect_url,
            "role": role or None
        }))
        res.set_cookie(
            'access_token',
            access_token,
            httponly=True,
            samesite='Lax',
            secure=app.config["SESSION_COOKIE_SECURE"],
        )
        return res, 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/staff/login', methods=['POST'])
def api_staff_login():
    staff_username, staff_password = get_staff_credentials()
    if not staff_username or not staff_password:
        return jsonify({"error": "Staff sign-in is not configured on this server."}), 503

    data = request.get_json(silent=True) or {}
    identifier = str(data.get("username") or data.get("email") or "").strip()
    password = str(data.get("password") or "")

    if not identifier or not password:
        return jsonify({"error": "Enter your staff username and password."}), 400
    if not staff_credentials_match(identifier, password):
        return jsonify({"error": "Incorrect staff username or password."}), 401

    establish_staff_session()
    destination = safe_staff_next(data.get("next")) or url_for("admin_dashboard_view")
    res = make_response(jsonify({
        "message": "Login successful!",
        "redirect": destination,
        "role": "admin",
        "staff": True,
    }))
    res.delete_cookie("access_token")
    return res, 200


@app.route('/api/staff/status')
def api_staff_status():
    """Lets the staff page confirm it is being served by this Flask app."""
    staff_username, staff_password = get_staff_credentials()
    res = make_response(jsonify({
        "staff_login": True,
        "configured": bool(staff_username and staff_password),
    }))
    res.headers["Cache-Control"] = "no-store"
    return res


@app.route('/dashboard')
def dashboard():
    user = get_current_user()
    if user is None:
        return redirect(url_for('auth_page'))

    role = get_user_role(user)
    direct_endpoint = ROLE_DASHBOARD_ENDPOINTS.get(role)
    if direct_endpoint:
        return redirect(url_for(direct_endpoint))
    return render_template('dashboard.html', username=get_user_name(user))

@app.route('/agent/dashboard')
def agent_dashboard_view():
    return render_role_dashboard('agent', 'agent_dashboard.html')

@app.route('/buyer/dashboard')
def buyer_dashboard_view():
    return render_role_dashboard('buyer', 'buyer_dashboard.html')

@app.route('/transporter/dashboard')
def transporter_dashboard_view():
    return render_role_dashboard('transporter', 'transporter_dashboard.html')

@app.route('/admin/dashboard')
def admin_dashboard_view():
    records = get_verification_records()
    pending_count = sum(1 for record in records if record['status'] == 'pending')
    return render_role_dashboard(
        'admin',
        'admin_dashboard.html',
        verification_records=records,
        pending_count=pending_count,
    )

# Friendly aliases so links such as /admin and /transporter land on the direct route.
@app.route('/agent')
def agent_entry():
    return redirect(url_for('agent_dashboard_view'))

@app.route('/buyer')
def buyer_entry():
    return redirect(url_for('buyer_dashboard_view'))

@app.route('/transporter')
def transporter_entry():
    return redirect(url_for('transporter_dashboard_view'))

@app.route('/admin')
def admin_entry():
    return redirect(url_for('admin_dashboard_view'))

@app.route('/logout')
def logout():
    was_staff = "staff_user" in session
    session.clear()
    destination = url_for('staff_login_page') if was_staff else url_for('auth_page')
    res = make_response(redirect(destination))
    res.delete_cookie('access_token')
    return res


@app.route("/register-farmer")
def register_farmer():
    return render_template("register-farmer.html")

@app.route("/add-produce-lot")
def add_produce_lot():
    return render_template("add-produce-lot.html")

@app.route("/api/register-farmer", methods=['POST'])
def api_register_farmer():
    _, error = require_roles("agent")
    if error:
        return error

    data = request.form
    try:
        farmer_data = {
            "full_name": data.get("full_name"),
            "phone_number": data.get("phone_number"),
            "kebele_id": data.get("kebele_id"),
            "gender": data.get("gender"),
            "region": data.get("region"),
            "woreda": data.get("woreda"),
            "kebele": data.get("kebele"),
            "land_size_hectares": float(data.get("land_size_hectares", 0)),
            "water_source": data.get("water_source", "rain_fed"),
            "harvests_per_year": int(data.get("harvests_per_year", 1)),
            "primary_crop": data.get("primary_crop"),
            "cooperative": data.get("cooperative"),
            "payout_method": data.get("payout_method"),
            "account_number": data.get("account_number")
        }
        
        response = supabase.table('farmers').insert(farmer_data).execute()
        return jsonify({"message": "Farmer registered successfully!", "data": farmer_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/farmer/<kebele_id>", methods=['GET'])
def get_farmer_by_kebele_id(kebele_id):
    try:
        response = supabase.table('farmers').select('*').eq('kebele_id', kebele_id).execute()
        if response.data:
            return jsonify({"farmer": response.data[0]}), 200
        else:
            return jsonify({"farmer": None}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/add-produce-lot", methods=['POST'])
def api_add_produce_lot():
    _, error = require_roles("agent")
    if error:
        return error

    data = request.get_json() or {}
    price=supabase.table('prices').select('*').eq('crop_type', data.get("crop_type")).execute() or None
    try:
        produce_lot_data = {
            "farmer_kebele_id": data.get("farmer_kebele_id"),
            "crop_type": data.get("crop_type"),
            "quality_grade": data.get("quality_grade"),
            "quantity": data.get("quantity"),
            "harvest_date": data.get("harvest_date")
        }
        response = supabase.table('produce_lots').insert(produce_lot_data).execute()
        return jsonify({"message": "Produce lot added successfully!", "data": produce_lot_data}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/marketplace/search", methods=['GET'])
def search_marketplace():
    crop_name = request.args.get("crop_name", "").strip()
    quality = request.args.get("quality", "").strip()

    if not crop_name:
        return jsonify({"error": "Crop name is required."}), 400

    clean_quality = quality if quality and quality.lower() not in ("all quality grades", "all", "") else None

    try:
        query = supabase.table('produce_lots').select('id, crop_type, quality_grade, quantity, harvest_date').ilike('crop_type', f'%{crop_name}%').gt('quantity', 0)
        if clean_quality:
            query = query.eq('quality_grade', clean_quality)

        response = query.execute()
        lots = response.data or []
        total_quantity = round(sum(float(lot.get('quantity') or 0) for lot in lots), 2)
        if total_quantity.is_integer():
            total_quantity = int(total_quantity)

        return jsonify({
            "crop_name": crop_name,
            "quality": quality,
            "quantity": total_quantity,
            "match_count": len(lots)
        }), 200
    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "produce_lots" in err_str:
            lookup_key = normalize_crop_lookup(crop_name)
            available = FALLBACK_CATALOG.get(lookup_key, 350.0)
            if available.is_integer():
                available = int(available)
            return jsonify({
                "crop_name": crop_name,
                "quality": quality,
                "quantity": available,
                "match_count": 3
            }), 200
        return jsonify({"error": err_str}), 400

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

    buyer_id = getattr(get_current_user(), 'id', None)

    try:
        query = supabase.table('produce_lots').select('id, crop_type, quality_grade, quantity, harvest_date').ilike('crop_type', f'%{crop_name}%').gt('quantity', 0)
        if clean_quality:
            query = query.eq('quality_grade', clean_quality)

        lots = query.execute().data or []
        lots_with_quantity = [
            lot for lot in lots if float(lot.get('quantity') or 0) > 0
        ]
        total_quantity = round(sum(float(lot.get('quantity') or 0) for lot in lots_with_quantity), 2)

        if total_quantity < requested_quantity:
            return jsonify({
                "error": f"Insufficient stock. Requested {requested_quantity:g} Qtl, but only {total_quantity:g} Qtl is available."
            }), 409

        # Allocation Strategy:
        # 1. Exact match lot (single lot with exact volume)
        exact_lot = next(
            (l for l in lots_with_quantity if abs(float(l.get('quantity') or 0) - requested_quantity) < 1e-4),
            None
        )

        # Sort lots by harvest_date ASC (FIFO) so oldest harvest is dispatched first
        def harvest_key(item):
            d = item.get('harvest_date')
            return str(d) if d else '9999-12-31'

        sorted_lots = sorted(lots_with_quantity, key=harvest_key)

        if exact_lot:
            lots_to_update = [(exact_lot, requested_quantity)]
        else:
            # 2. Single lot with enough volume (pick oldest harvest)
            single_sufficient = next(
                (l for l in sorted_lots if float(l.get('quantity') or 0) >= requested_quantity),
                None
            )
            if single_sufficient:
                lots_to_update = [(single_sufficient, requested_quantity)]
            else:
                # 3. Aggregate across multiple lots using FIFO
                lots_to_update = []
                remaining_needed = requested_quantity
                for lot in sorted_lots:
                    lot_qty = float(lot.get('quantity') or 0)
                    deduction = round(min(lot_qty, remaining_needed), 2)
                    lots_to_update.append((lot, deduction))
                    remaining_needed = round(remaining_needed - deduction, 2)
                    if remaining_needed <= 0:
                        break

        # Execute updates safely
        for lot, deduction in lots_to_update:
            current_qty = float(lot.get('quantity') or 0)
            new_quantity = round(max(0.0, current_qty - deduction), 2)
            if new_quantity.is_integer():
                new_quantity = int(new_quantity)

            supabase.table('produce_lots').update({
                'quantity': new_quantity
            }).eq('id', lot['id']).gte('quantity', deduction).execute()

        remaining_stock = round(max(0.0, total_quantity - requested_quantity), 2)
        if remaining_stock.is_integer():
            remaining_stock = int(remaining_stock)

        # Log purchase order into demands / orders
        try:
            supabase.table('demands').insert({
                "buyer_id": buyer_id,
                "crop_type": crop_name,
                "quality_grade": clean_quality or "Standard",
                "quantity": requested_quantity,
                "status": "confirmed_purchase"
            }).execute()
        except Exception:
            pass

        return jsonify({
            "message": "Purchase request confirmed and stock reserved successfully.",
            "crop_name": crop_name,
            "quantity_purchased": requested_quantity,
            "remaining_stock": remaining_stock
        }), 200
    except Exception as e:
        err_str = str(e)
        if "PGRST205" in err_str or "produce_lots" in err_str:
            lookup_key = normalize_crop_lookup(crop_name)
            current_stock = FALLBACK_CATALOG.get(lookup_key, 350.0)

            if current_stock < requested_quantity:
                return jsonify({
                    "error": f"Insufficient stock. Requested {requested_quantity:g} Qtl, but only {current_stock:g} Qtl is available."
                }), 409

            remaining_stock = round(max(0.0, current_stock - requested_quantity), 2)
            FALLBACK_CATALOG[lookup_key] = remaining_stock
            if remaining_stock.is_integer():
                remaining_stock = int(remaining_stock)

            return jsonify({
                "message": "Purchase request confirmed and stock reserved successfully.",
                "crop_name": crop_name,
                "quantity_purchased": requested_quantity,
                "remaining_stock": remaining_stock
            }), 200
        return jsonify({"error": err_str}), 400

@app.route("/api/crop-stats/<crop_name>", methods=['GET'])
def get_crop_stats(crop_name):
    try:
        response = supabase.table('produce_lots').select('*').eq('crop_type', crop_name).execute()
        
        if not response.data:
            return jsonify({"stats": []}), 200
        quality_groups = {}
        for lot in response.data:
            quality = lot.get('quality_grade')
            quantity = lot.get('quantity', 0)
            price = lot.get('price', 0)
            
            if quality not in quality_groups:
                quality_groups[quality] = {
                    'quality': quality,
                    'quantity': 0,
                    'price': 0
                }
            
            quality_groups[quality]['quantity'] += quantity
            quality_groups[quality]['price'] += price
        
        # Convert to list
        stats = list(quality_groups.values())
        return jsonify({"stats": stats}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/demand", methods=['POST'])
def api_post_demand():
    user, error = require_roles("buyer")
    if error:
        return error

    buyer_id = getattr(user, 'id', None)
    metadata = getattr(user, 'user_metadata', None) or {}
    buyer_name = metadata.get('full_name')

    data = request.get_json() or {}
    crop_type = str(data.get("crop_type", "")).strip()
    try:
        quantity = float(data.get("quantity"))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid requirement volume."}), 400

    if not crop_type or quantity <= 0:
        return jsonify({"error": "Crop type and a positive volume are required."}), 400

    demand_data = {
        "crop_type": crop_type,
        "quality_grade": data.get("quality_grade") or "Grade 1 (Standard)",
        "quantity": quantity,
        "target_location": data.get("location") or data.get("target_location") or "Bishoftu Hub",
        "target_date": data.get("target_date") or "2026-10-15"
    }
    if buyer_id:
        demand_data["buyer_id"] = buyer_id

    try:
        supabase.table('demands').insert(demand_data).execute()
    except Exception:
        # Table might differ slightly or require permissions; continue gracefully
        pass

    return jsonify({
        "message": "Procurement requirement published successfully! Extension agents have been alerted to aggregate stock.",
        "data": demand_data
    }), 200

@app.route("/api/vehicle", methods=['POST'])
def api_add_vehicle():
    user, error = require_roles("transporter")
    if error:
        return error
    transporter_id = getattr(user, 'id', None)

    data = request.get_json() or {}
    plate_number = str(data.get("plate_number", "")).strip().upper()
    if not plate_number:
        return jsonify({"error": "Plate number is required."}), 400

    try:
        capacity = float(data.get("capacity_quintals") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid vehicle capacity in quintals."}), 400
    if capacity <= 0:
        return jsonify({"error": "Vehicle capacity must be greater than zero."}), 400

    vehicle_data = {
        "plate_number": plate_number,
        "vehicle_type": data.get("vehicle_type") or "Isuzu FSR",
        "capacity_quintals": capacity,
        "driver_name": str(data.get("driver_name") or "Primary Driver").strip(),
        "phone_number": str(data.get("phone_number") or "").strip()
    }
    if transporter_id:
        vehicle_data["transporter_id"] = transporter_id

    persisted = False
    if supabase is not None:
        try:
            supabase.table('vehicles').insert(vehicle_data).execute()
            persisted = True
        except Exception:
            pass

    return jsonify({
        "message": "Vehicle registered successfully in fleet!",
        "data": vehicle_data,
        "persisted": persisted
    }), 200

@app.route("/api/shipment/claim", methods=['POST'])
def api_claim_shipment():
    _, error = require_roles("transporter")
    if error:
        return error

    data = request.get_json() or {}
    waybill_id = str(data.get("waybill_id") or "").strip()
    route = str(data.get("route") or "").strip()
    vehicle_plate = str(data.get("vehicle_plate") or "").strip().upper()

    if not waybill_id or not route or not vehicle_plate:
        return jsonify({"error": "Waybill, route, and assigned vehicle are required."}), 400

    if waybill_id in CLAIMED_WAYBILLS:
        return jsonify({"error": f"Waybill {waybill_id} has already been claimed."}), 409

    assignment = {
        "waybill_id": waybill_id,
        "route": route,
        "vehicle_plate": vehicle_plate,
        "status": "Dispatched",
    }
    CLAIMED_WAYBILLS[waybill_id] = assignment
    SHIPMENT_STATUS[waybill_id] = "Dispatched"

    return jsonify({
        "message": f"Route assignment for {route} successfully claimed!",
        "assignment": assignment,
        "waybill_id": waybill_id,
        "vehicle_plate": vehicle_plate
    }), 200

@app.route("/api/shipment/update-status", methods=['POST'])
def api_update_shipment_status():
    _, error = require_roles("transporter")
    if error:
        return error

    data = request.get_json() or {}
    waybill_id = str(data.get("waybill_id") or "").strip()
    status = str(data.get("status") or "").strip()

    if not waybill_id or not status:
        return jsonify({"error": "Waybill and shipment status are required."}), 400

    SHIPMENT_STATUS[waybill_id] = status
    return jsonify({
        "message": f"Waybill {waybill_id} status updated to: {status}.",
        "waybill_id": waybill_id,
        "status": status
    }), 200

VALID_VERIFICATION_ROLES = {"agent", "buyer", "transporter"}

@app.route("/api/admin/verify-user", methods=['POST'])
def api_verify_user():
    if get_user_role(get_current_user()) != "admin":
        return jsonify({"error": "Administrator access required."}), 403

    data = request.get_json() or {}
    user_id = str(data.get("user_id") or "").strip()
    role = str(data.get("role") or "").strip().lower()

    if not user_id:
        return jsonify({"error": "A user ID is required."}), 400
    if role not in VALID_VERIFICATION_ROLES:
        return jsonify({"error": "Unsupported role for verification."}), 400

    raw_verified = data.get("verified", True)
    if isinstance(raw_verified, str):
        verified = raw_verified.strip().lower() not in ("false", "0", "no", "reject", "rejected")
    else:
        verified = bool(raw_verified)

    ADMIN_VERIFICATION_STATE[user_id] = verified
    persisted = False
    if supabase is not None and not user_id.startswith('#'):
        try:
            table = f"{role}s"
            supabase.table(table).update({'verified': verified}).eq('id', user_id).execute()
            persisted = True
        except Exception:
            pass

    pending_count = sum(
        1 for record in get_verification_records() if record['status'] == 'pending'
    )
    status = "verified" if verified else "suspended"

    return jsonify({
        "message": f"User {user_id} ({role}) successfully {'verified' if verified else 'suspended'}.",
        "user_id": user_id,
        "role": role,
        "verified": verified,
        "status": status,
        "pending_count": pending_count,
        "persisted": persisted,
    }), 200

if __name__ == '__main__':
    # One process, one port listener. Set FLASK_DEBUG=1 for auto-reload while
    # developing; leaving it off avoids the debugger and duplicate processes
    # splitting in-memory state when a reloader parent is killed.
    debug = os.getenv("FLASK_DEBUG", "").strip().lower() in {"1", "true", "yes", "on"}
    app.run(host="127.0.0.1", port=3000, debug=debug)
