from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response, g, session
from supabase import create_client, Client
import os
import uuid
import datetime
import math
import base64
import json
from types import SimpleNamespace
from urllib.parse import urlparse
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash

from functools import wraps

load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY")
if not app.secret_key:
    raise RuntimeError("FLASK_SECRET_KEY is required for secure staff sessions. Add it to the local .env file.")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = os.getenv("FLASK_SESSION_COOKIE_SECURE", "false").lower() == "true"
app.config["PERMANENT_SESSION_LIFETIME"] = datetime.timedelta(hours=8)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TRANSPORT_RATE_ETB_PER_QTL = float(os.getenv("TRANSPORT_RATE_ETB_PER_QTL", "0") or 0)
ETHIOPIAN_HUBS = [
    "Addis Ababa Hub", "Adama Hub", "Bahir Dar Hub", "Bishoftu Hub",
    "Dire Dawa Hub", "Dessie Hub", "Gondar Hub", "Hawassa Hub",
    "Jimma Hub", "Jijiga Hub", "Mekelle Hub", "Nekemte Hub",
    "Shashamane Hub", "Wolaita Sodo Hub",
]
# Initial road-neighbor map for replenishment matching. Keep the edges symmetric;
# administrators can later replace this policy with route-distance data.
HUB_NEIGHBORS = {
    "Addis Ababa Hub": ["Bishoftu Hub", "Adama Hub", "Nekemte Hub"],
    "Adama Hub": ["Bishoftu Hub", "Addis Ababa Hub", "Dire Dawa Hub", "Hawassa Hub", "Shashamane Hub"],
    "Bahir Dar Hub": ["Gondar Hub", "Dessie Hub"],
    "Bishoftu Hub": ["Addis Ababa Hub", "Adama Hub"],
    "Dire Dawa Hub": ["Adama Hub", "Jijiga Hub"],
    "Dessie Hub": ["Bahir Dar Hub", "Mekelle Hub"],
    "Gondar Hub": ["Bahir Dar Hub"],
    "Hawassa Hub": ["Adama Hub", "Jimma Hub", "Shashamane Hub"],
    "Jimma Hub": ["Hawassa Hub", "Nekemte Hub", "Wolaita Sodo Hub"],
    "Jijiga Hub": ["Dire Dawa Hub"],
    "Mekelle Hub": ["Dessie Hub"],
    "Nekemte Hub": ["Addis Ababa Hub", "Jimma Hub"],
    "Shashamane Hub": ["Adama Hub", "Hawassa Hub", "Wolaita Sodo Hub"],
    "Wolaita Sodo Hub": ["Jimma Hub", "Shashamane Hub"],
}
HUB_MIN_RESERVE_QTL = 10
if not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required for server-side database access.")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is required. Add it to the local .env file.")

# Catch the common setup mistake where a valid key from another Supabase
# project is paired with this project's URL.
if SUPABASE_SERVICE_ROLE_KEY.count(".") == 2:
    try:
        payload = SUPABASE_SERVICE_ROLE_KEY.split(".")[1]
        payload += "=" * ((4 - len(payload) % 4) % 4)
        service_claims = json.loads(base64.urlsafe_b64decode(payload))
    except Exception as exc:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not a valid JWT/API key.") from exc
    service_role = service_claims.get("role")
    if service_role and service_role != "service_role":
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY must be the service_role key, not an anon/publishable key.")
    project_ref = (urlparse(SUPABASE_URL).hostname or "").split(".")[0]
    key_project_ref = service_claims.get("ref")
    if project_ref and key_project_ref and project_ref != key_project_ref:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY belongs to a different Supabase project than SUPABASE_URL.")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_auth_client():
    client = getattr(g, "supabase_auth_client", None)
    if client is None:
        client = create_client(SUPABASE_URL, SUPABASE_KEY)
        g.supabase_auth_client = client
    return client


def get_current_user():
    """Return a database staff principal or a Supabase-authenticated buyer."""
    staff = get_current_staff_account()
    if staff:
        return SimpleNamespace(
            id=staff["id"], email=staff["username"],
            user_metadata={"full_name": staff["full_name"]},
            app_metadata={"role": staff["role"]},
            is_staff_account=True, active=staff["active"], hub_location=staff.get("hub_location")
        )
    token = request.cookies.get('access_token')
    if not token:
        return None
    try:
        response = get_auth_client().auth.get_user(token)
        return response.user if response else None
    except Exception:
        return None


def get_current_staff_account():
    staff_id = session.get("staff_id")
    if not staff_id:
        return None
    try:
        result = supabase.table("staff_accounts").select("*").eq("id", staff_id).maybe_single().execute()
        # PostgREST's maybe_single() returns None (not an empty response) when
        # no row matches, such as after a staff account has been removed.
        account = result.data if result else None
        if not account or not account.get("active"):
            session.pop("staff_id", None)
            return None
        return account
    except Exception:
        return None


def ensure_initial_admin():
    """Create the requested starter admin once, unless an admin already exists."""
    username = os.getenv("INITIAL_ADMIN_USERNAME", "admin").strip().lower() or "admin"
    password = os.getenv("INITIAL_ADMIN_PASSWORD", "admin_password")
    existing = supabase.table("staff_accounts").select("id").eq("role", "admin").limit(1).execute().data or []
    if existing:
        return
    try:
        supabase.table("staff_accounts").insert({
            "username": username,
            "full_name": username,
            "role": "admin",
            "password_hash": generate_password_hash(password),
            "active": True
        }).execute()
    except Exception:
        # A concurrent first login may have created the initial admin.
        existing = supabase.table("staff_accounts").select("id").eq("role", "admin").limit(1).execute().data or []
        if not existing:
            raise
def require_roles(*roles):
    """Enforce database-backed staff or Supabase buyer roles on the server."""
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({"error": "Authentication required."}), 401
            role = resolve_user_role(user)
            if role not in roles:
                return jsonify({"error": "You do not have permission to perform this action."}), 403
            if role != 'admin':
                profile = profile_for_user(user, role)
                if not profile or not profile.get("verified"):
                    return jsonify({"error": "Your account is awaiting verification."}), 403
            g.current_user = user
            g.current_role = role
            return view(*args, **kwargs)
        return wrapped
    return decorator


def current_user():
    return getattr(g, "current_user", None) or get_current_user()


def profile_for_user(user, role):
    if getattr(user, "is_staff_account", False):
        return {"verified": bool(getattr(user, "active", False))}
    if role not in ('agent', 'buyer', 'transporter'):
        return None
    result = supabase.table(f"{role}s").select('*').eq("auth_user_id", user.id).maybe_single().execute()
    profile = result.data if result else None
    if profile or role != 'buyer':
        return profile

    # Older/partially completed signups can leave a valid Supabase Auth user
    # without its buyer profile. Create it as unverified so it enters the
    # normal admin review queue instead of crashing or being silently approved.
    metadata = getattr(user, "user_metadata", None) or {}
    try:
        inserted = supabase.table("buyers").insert({
            "auth_user_id": user.id,
            "full_name": metadata.get("full_name") or getattr(user, "email", None) or "Buyer",
            "email": getattr(user, "email", None),
            "verified": False,
        }).execute().data or []
        if inserted:
            return inserted[0]
    except Exception:
        # A concurrent request may have created the profile after our lookup.
        pass

    retry = supabase.table("buyers").select('*').eq("auth_user_id", user.id).limit(1).execute().data or []
    return retry[0] if retry else None


def resolve_user_role(user):
    if getattr(user, "is_staff_account", False):
        return (getattr(user, "app_metadata", None) or {}).get("role")
    # Supabase Auth is used for buyer accounts only. Staff roles are sourced
    # exclusively from active rows in staff_accounts.
    return 'buyer' if profile_for_user(user, 'buyer') else None


# ----------------------------------------------------
# Page Routes
# ----------------------------------------------------
@app.route('/')
def home():
    return render_template('homepage.html')


@app.route('/auth')
def auth_page():
    return render_template('auth.html')


@app.route('/staff/login', methods=['GET'])
def staff_login_page():
    if get_current_staff_account():
        return redirect('/dashboard')
    return render_template('staff_login.html')


@app.route('/api/staff/login', methods=['POST'])
def api_staff_login():
    data = request.get_json() or {}
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    if not username or not password:
        return jsonify({"error": "Enter your staff name and password."}), 400
    try:
        ensure_initial_admin()
        result = supabase.table("staff_accounts").select("id,username,role,password_hash,active").eq("username", username).limit(1).execute()
        account = (result.data or [None])[0]
        if not account or not account.get("active") or not check_password_hash(account["password_hash"], password):
            return jsonify({"error": "Invalid staff name or password."}), 401
        session.clear()
        session["staff_id"] = account["id"]
        session.permanent = True
        return jsonify({"message": "Staff login successful."}), 200
    except Exception:
        app.logger.exception("Staff login failed")
        return jsonify({"error": "Staff sign-in is temporarily unavailable. Check the Supabase service key and confirm the staff_accounts migration has been run."}), 503


@app.route('/dashboard')
def dashboard():
    return redirect('/dashboard/overview')


@app.route('/dashboard/overview')
def dashboard_overview():
    return _render_dashboard_for_current_user(view_name='overview')


@app.route('/dashboard/transporter')
def transporter_dashboard():
    return redirect('/dashboard/transporter/overview')


@app.route('/dashboard/transporter/<view_name>')
def transporter_dashboard_view(view_name):
    view_name = (view_name or '').strip().lower()
    allowed_transporter_views = {
        'overview',
        'loads',
        'fleet',
        'history',
    }
    if view_name not in allowed_transporter_views:
        return redirect('/dashboard/transporter/overview')
    return _render_dashboard_for_current_user(view_name=view_name, role_prefix='transporter')


@app.route('/dashboard/<view_name>')
def dashboard_view(view_name):
    view_name = (view_name or '').strip().lower()
    allowed_agent_views = {
        'overview',
        'farmers',
        'produce-lots',
        'orders',
        'transfer-approvals',
        'hub-supply',
        'new-product-lot',
    }
    if view_name not in allowed_agent_views:
        return redirect('/dashboard/overview')
    return _render_dashboard_for_current_user(view_name=view_name)


def _render_dashboard_for_current_user(view_name=None, role_prefix=None):
    token = request.cookies.get('access_token')
    staff_account = get_current_staff_account()
    if not token and not staff_account:
        return redirect('/auth')

    user = get_current_user()
    if not user:
        res = make_response(redirect('/auth'))
        res.delete_cookie('access_token')
        return res

    role = resolve_user_role(user) if user else None
    user_name = (user.user_metadata or {}).get('full_name') if user else None

    if role not in ('agent', 'buyer', 'transporter', 'admin'):
        return redirect('/auth')
    if role != 'admin':
        profile = profile_for_user(user, role)
        if not profile or not profile.get('verified'):
            return render_template('pending_verification.html', username=user_name)

    if role == 'agent':
        active_page = view_name or 'overview'
        if active_page == 'new-product-lot':
            return redirect('/add-produce-lot')
        return render_template(
            'agent_dashboard.html',
            username=user_name,
            hub_location=getattr(user, 'hub_location', None),
            hubs=ETHIOPIAN_HUBS,
            active_page=active_page,
        )
    elif role == 'buyer':
        return render_template('buyer_dashboard.html', username=user_name)
    elif role == 'transporter':
        active_page = view_name or 'overview'
        return render_template(
            'transporter_dashboard.html',
            username=user_name,
            active_page=active_page,
        )
    elif role == 'admin':
        return render_template('admin_dashboard.html', username=user_name, hubs=ETHIOPIAN_HUBS)
    return redirect('/auth')


@app.route('/logout')
def logout():
    was_staff = bool(session.get("staff_id"))
    session.clear()
    res = make_response(redirect('/staff/login' if was_staff else '/auth'))
    res.delete_cookie('access_token')
    return res


@app.route("/register-farmer")
def register_farmer():
    user = get_current_user()
    if not user:
        return redirect('/auth')
    role = resolve_user_role(user)
    if role not in ('agent', 'admin'):
        return redirect('/dashboard')
    if role == 'agent' and not profile_for_user(user, role).get('verified'):
        return redirect('/dashboard')
    return render_template("register-farmer.html")


@app.route("/add-produce-lot")
def add_produce_lot():
    user = get_current_user()
    if not user:
        return redirect('/auth')
    role = resolve_user_role(user)
    if role not in ('agent', 'admin'):
        return redirect('/dashboard')
    if role == 'agent' and not profile_for_user(user, role).get('verified'):
        return redirect('/dashboard')
    assigned_hub = (get_current_staff_account() or {}).get("hub_location") if role == 'agent' else None
    return render_template("add-produce-lot.html", hubs=ETHIOPIAN_HUBS, assigned_hub=assigned_hub)


# ----------------------------------------------------
# Auth APIs
# ----------------------------------------------------
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")
    full_name = data.get("full_name") or "New User"
    # Public self-registration creates buyer accounts only. Staff accounts
    # are provisioned by AgriBridge and use the same login endpoint.
    requested_role = data.get("role")
    if requested_role not in (None, "buyer"):
        return jsonify({
            "error": "Self-registration is available for buyers only. Please use your company-issued account to log in."
        }), 403
    role = "buyer"

    try:
        response = get_auth_client().auth.sign_up({
            "email": email,
            "password": password,
            "options": {
                "data": {
                    "full_name": full_name,
                    "role": role
                }
            }
        })
        if not getattr(response, 'user', None):
            return jsonify({"error": "Could not create authentication account."}), 400
        user_id = response.user.id
        supabase.table(f"{role}s").insert({
            "auth_user_id": user_id, "full_name": full_name,
            "email": email, "verified": False
        }).execute()

        return jsonify({"message": "Signup successful. An administrator must verify your buyer account before you can purchase produce.", "user_id": user_id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json() or {}
    email = data.get("email")
    password = data.get("password")

    try:
        response = get_auth_client().auth.sign_in_with_password({
            "email": email,
            "password": password
        })
        auth_session = getattr(response, 'session', None)
        if not auth_session or not auth_session.access_token:
            return jsonify({"error": "Unable to start session. Please verify your email or credentials."}), 400
        access_token = auth_session.access_token
        session.clear()
        res = make_response(jsonify({"message": "Login successful!"}))
        res.set_cookie('access_token', access_token, httponly=True, secure=request.is_secure, samesite='Lax')
        return res, 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route('/api/forgot-password', methods=['POST'])
def api_forgot_password():
    data = request.get_json() or {}
    email = str(data.get("email", "")).strip()

    if not email:
        return jsonify({"error": "Please enter your registered email address."}), 400

    try:
        redirect_url = request.host_url.rstrip('/') + url_for('auth_page') + '?mode=reset'
        get_auth_client().auth.reset_password_for_email(email, {"redirect_to": redirect_url})
    except Exception as e:
        print("Password reset note:", e)

    return jsonify({
        "message": f"If an account exists for {email}, a password recovery link has been sent.",
        "email": email
    }), 200


@app.route('/api/update-password', methods=['POST'])
def api_update_password():
    data = request.get_json() or {}
    new_password = str(data.get("password", "")).strip()
    access_token = data.get("access_token") or request.cookies.get('access_token')

    if not new_password or len(new_password) < 8:
        return jsonify({"error": "Password must be at least 8 characters long."}), 400

    if not access_token:
        return jsonify({"error": "Session expired or invalid reset link. Please request a new recovery link."}), 400

    try:
        get_auth_client().auth.set_session(access_token, "")
        get_auth_client().auth.update_user({"password": new_password})
        return jsonify({"message": "Password updated successfully! Please log in with your new password."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ----------------------------------------------------
# Farmers & Produce Lots APIs (Agent Terminal)
# ----------------------------------------------------
@app.route("/api/agent/farmers", methods=['GET'])
@require_roles('agent', 'admin')
def api_get_agent_farmers():
    try:
        query = supabase.table('farmers').select('*').order('created_at', desc=True)
        if getattr(g, 'current_role', None) == 'agent':
            query = query.eq('agent_id', current_user().id)
        farmers = query.execute().data or []
        return jsonify({"farmers": farmers}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/register-farmer", methods=['POST'])
@require_roles('agent', 'admin')
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

        farmer_data["agent_id"] = current_user().id
        sb_res = supabase.table('farmers').insert(farmer_data).execute()
        saved_farmer = sb_res.data[0]

        return jsonify({"message": "Farmer registered successfully!", "data": saved_farmer}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/farmer/<kebele_id>", methods=['GET'])
@require_roles('agent', 'admin')
def get_farmer_by_kebele_id(kebele_id):
    try:
        query = supabase.table('farmers').select('*').eq('kebele_id', kebele_id)
        if getattr(g, 'current_role', None) == 'agent':
            query = query.eq('agent_id', current_user().id)
        res = query.maybe_single().execute()
        farmer = res.data if res else None

        if farmer:
            return jsonify({"farmer": farmer}), 200
        else:
            return jsonify({"farmer": None}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/agent/produce-lots", methods=['GET'])
@require_roles('agent', 'admin')
def api_get_agent_produce_lots():
    try:
        query = supabase.table('produce_lots').select('*').order('created_at', desc=True)
        if getattr(g, 'current_role', None) == 'agent':
            query = query.eq('agent_id', current_user().id)
        lots = query.execute().data or []
        configured_prices = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl').execute().data or []
        rates_by_crop = {row['crop_type'].casefold(): float(row['fixed_price_per_qtl']) for row in configured_prices}
        for lot in lots:
            current_rate = rates_by_crop.get(str(lot.get('crop_type') or '').casefold())
            if current_rate is not None:
                lot['price_per_qtl'] = current_rate
        return jsonify({"lots": lots}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


def editable_agent_lot(lot_id, agent_id):
    response = supabase.table('produce_lots').select('*').eq('id', lot_id).eq('agent_id', agent_id).maybe_single().execute()
    lot = response.data if response else None
    if not lot:
        return None, (jsonify({"error": "Produce lot not found."}), 404)
    try:
        quantity = float(lot.get('quantity') or 0)
        initial_quantity = float(lot.get('initial_quantity') or 0)
    except (TypeError, ValueError):
        quantity, initial_quantity = -1, 0
    if lot.get('status') != 'In Hub Silo' or quantity <= 0 or quantity != initial_quantity:
        return None, (jsonify({"error": "This lot is locked because some of its stock has already been ordered or reserved."}), 409)
    allocations = supabase.table('shipment_lot_allocations').select('id').eq('produce_lot_id', lot_id).limit(1).execute().data or []
    if allocations:
        return None, (jsonify({"error": "This lot has transfer history and can no longer be changed."}), 409)
    return lot, None


@app.route("/api/agent/produce-lots/<lot_id>", methods=['PATCH'])
@require_roles('agent')
def api_update_agent_produce_lot(lot_id):
    user_id = current_user().id
    lot, error_response = editable_agent_lot(lot_id, user_id)
    if error_response:
        return error_response
    data = request.get_json() or {}
    crop_name = str(data.get('crop_type') or '').strip()
    quality = str(data.get('quality_grade') or '').strip()
    source_hub = str(data.get('hub_location') or '').strip()
    target_hub = str(data.get('target_hub') or '').strip()
    harvest_date = str(data.get('harvest_date') or '').strip()
    try:
        quantity = float(data.get('quantity'))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid produce quantity."}), 400
    if not crop_name or not math.isfinite(quantity) or quantity <= 0:
        return jsonify({"error": "Choose a crop and enter a positive quantity."}), 400
    if quality not in ('Grade 1 (Magna / Premium)', 'Grade 1 (Standard)', 'Grade 2 Commercial', 'Export Quality Verified'):
        return jsonify({"error": "Choose a valid quality grade."}), 400
    assigned_hub = (get_current_staff_account() or {}).get("hub_location")
    if assigned_hub not in ETHIOPIAN_HUBS or source_hub != assigned_hub:
        return jsonify({"error": "Your account must have a hub assignment, and produce lots can only be recorded at that hub."}), 403
    if target_hub and (target_hub not in ETHIOPIAN_HUBS or target_hub == source_hub):
        return jsonify({"error": "Choose a valid different destination hub, or leave it blank."}), 400
    try:
        datetime.date.fromisoformat(harvest_date)
    except ValueError:
        return jsonify({"error": "Enter a valid harvest date."}), 400
    try:
        prices = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl').eq('active', True).execute().data or []
        crop_price = next((row for row in prices if row['crop_type'].casefold() == crop_name.casefold()), None)
        if not crop_price:
            return jsonify({"error": "That crop has no active fixed price."}), 400
        old_quantity = float(lot['quantity'])
        old_initial = float(lot['initial_quantity'])
        updated = supabase.table('produce_lots').update({
            'crop_type': crop_price['crop_type'], 'quality_grade': quality,
            'quantity': quantity, 'initial_quantity': quantity,
            'price_per_qtl': float(crop_price['fixed_price_per_qtl']),
            'harvest_date': harvest_date, 'hub_location': source_hub, 'target_hub': target_hub or None,
        }).eq('id', lot_id).eq('agent_id', user_id).eq('status', 'In Hub Silo').eq('quantity', old_quantity).eq('initial_quantity', old_initial).select('id').execute().data or []
        if not updated:
            return jsonify({"error": "The lot changed while you were editing it. Refresh the page and try again."}), 409
        return jsonify({"message": "Produce lot correction saved.", "lot": updated[0]}), 200
    except Exception:
        app.logger.exception("Could not update produce lot")
        return jsonify({"error": "Could not update produce lot."}), 400


@app.route("/api/agent/produce-lots/<lot_id>", methods=['DELETE'])
@require_roles('agent')
def api_delete_agent_produce_lot(lot_id):
    user_id = current_user().id
    lot, error_response = editable_agent_lot(lot_id, user_id)
    if error_response:
        return error_response
    try:
        quantity = float(lot['quantity'])
        initial_quantity = float(lot['initial_quantity'])
        deleted = supabase.table('produce_lots').delete().eq('id', lot_id).eq('agent_id', user_id).eq('status', 'In Hub Silo').eq('quantity', quantity).eq('initial_quantity', initial_quantity).select('id').execute().data or []
        if not deleted:
            return jsonify({"error": "The lot changed while you were removing it. Refresh and try again."}), 409
        return jsonify({"message": "Unused produce lot removed."}), 200
    except Exception:
        app.logger.exception("Could not remove produce lot")
        return jsonify({"error": "Could not remove produce lot."}), 400


@app.route("/api/agent/crop-prices", methods=['GET'])
@require_roles('agent', 'admin')
def api_get_active_crop_prices():
    try:
        prices = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl').eq('active', True).order('crop_type').execute().data or []
        return jsonify({"crop_prices": prices}), 200
    except Exception as e:
        app.logger.exception("Could not load crop price list")
        return jsonify({"error": "Crop prices are unavailable. Ask an administrator to configure crop prices."}), 503


@app.route("/api/add-produce-lot", methods=['POST'])
@require_roles('agent', 'admin')
def api_add_produce_lot():
    data = request.get_json() or {}
    try:
        crop_name = str(data.get("crop_type") or "").strip()
        try:
            quantity = float(data.get("quantity"))
        except (TypeError, ValueError):
            return jsonify({"error": "Enter a valid produce quantity."}), 400
        if not crop_name or not math.isfinite(quantity) or quantity <= 0:
            return jsonify({"error": "Choose a crop and enter a positive quantity."}), 400

        configured_prices = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl').eq('active', True).execute().data or []
        configured_price = next((row for row in configured_prices if row.get('crop_type', '').casefold() == crop_name.casefold()), None)
        if not configured_price:
            return jsonify({"error": "That crop has no active fixed price. Ask an administrator to configure it."}), 400

        produce_lot_data = {
            "farmer_kebele_id": data.get("farmer_kebele_id"),
            "crop_type": configured_price['crop_type'],
            "quality_grade": data.get("quality_grade") or "Grade 1 (Standard)",
            "quantity": quantity,
            "harvest_date": data.get("harvest_date") or datetime.date.today().isoformat(),
            "price_per_qtl": float(configured_price['fixed_price_per_qtl']),
            "lot_ref": f"LOT-{uuid.uuid4().hex[:10].upper()}",
            "status": "In Hub Silo"
        }

        farmer_result = supabase.table('farmers').select('kebele_id,agent_id').eq('kebele_id', produce_lot_data['farmer_kebele_id']).maybe_single().execute()
        farmer = farmer_result.data if farmer_result else None
        if not farmer:
            return jsonify({"error": "Farmer not found."}), 404
        if getattr(g, 'current_role', None) == 'agent' and farmer.get('agent_id') != current_user().id:
            return jsonify({"error": "You can only add produce for farmers in your registration records."}), 403
        produce_lot_data["agent_id"] = current_user().id
        origin_hub = str(data.get("hub_location") or "").strip()
        target_hub = str(data.get("target_hub") or "").strip()
        assigned_hub = (get_current_staff_account() or {}).get("hub_location") if getattr(g, 'current_role', None) == 'agent' else None
        if getattr(g, 'current_role', None) == 'agent':
            if assigned_hub not in ETHIOPIAN_HUBS:
                return jsonify({"error": "Your account must be assigned to a valid hub before recording produce."}), 403
            origin_hub = assigned_hub
        if origin_hub not in ETHIOPIAN_HUBS:
            return jsonify({"error": "Choose a valid source hub."}), 400
        if target_hub and (target_hub not in ETHIOPIAN_HUBS or target_hub == origin_hub):
            return jsonify({"error": "Choose a valid different destination hub, or leave it blank."}), 400
        produce_lot_data["hub_location"] = origin_hub
        produce_lot_data["target_hub"] = target_hub or None
        produce_lot_data["initial_quantity"] = produce_lot_data["quantity"]
        sb_res = supabase.table('produce_lots').insert(produce_lot_data).execute()
        saved_lot = sb_res.data[0]
        return jsonify({"message": "Produce lot added successfully to your assigned hub.", "data": saved_lot}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ----------------------------------------------------
# Marketplace APIs (Search & Purchase Only)
# Buyers search & purchase stock. No posting demands.
# ----------------------------------------------------
@app.route("/api/marketplace/summary", methods=['GET'])
@require_roles('buyer')
def marketplace_summary():
    active_prices = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl').eq('active', True).execute().data or []
    prices_by_crop = {row['crop_type'].casefold(): float(row['fixed_price_per_qtl']) for row in active_prices}
    all_lots = supabase.table('produce_lots').select('crop_type,quantity,hub_location,status').execute().data or []
    available_lots = [
        lot for lot in all_lots
        if lot.get('status') == 'In Hub Silo'
        and float(lot.get('quantity') or 0) > 0
        and str(lot.get('crop_type') or '').casefold() in prices_by_crop
    ]
    return jsonify({
        "available_quantity": round(sum(float(lot.get('quantity') or 0) for lot in available_lots), 2),
        "lot_count": len(available_lots),
        "hub_locations": sorted({lot.get('hub_location') for lot in available_lots if lot.get('hub_location')})
    }), 200


@app.route("/api/marketplace/search", methods=['GET'])
@require_roles('buyer')
def search_marketplace():
    crop_name = request.args.get("crop_name", "").strip()
    quality = request.args.get("quality", "").strip()
    hub_location = request.args.get("hub_location", "").strip()

    if not crop_name:
        return jsonify({"error": "Crop name is required."}), 400

    clean_quality = quality if quality and quality.lower() not in ("all quality grades", "all", "") else None

    query = supabase.table('produce_lots').select('*').ilike('crop_type', f'%{crop_name}%').gt('quantity', 0).eq('status', 'In Hub Silo')
    if hub_location:
        query = query.eq('hub_location', hub_location)
    if clean_quality:
        query = query.eq('quality_grade', clean_quality)
    lots = query.execute().data or []
    active_prices = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl').eq('active', True).execute().data or []
    prices_by_crop = {row['crop_type'].casefold(): float(row['fixed_price_per_qtl']) for row in active_prices}
    lots = [lot for lot in lots if str(lot.get('crop_type') or '').casefold() in prices_by_crop]
    for lot in lots:
        lot['price_per_qtl'] = prices_by_crop[str(lot['crop_type']).casefold()]
    crop_types = sorted({lot.get('crop_type') for lot in lots if lot.get('crop_type')})

    total_quantity = round(sum(float(lot.get('quantity') or 0) for lot in lots), 2)
    if float(total_quantity).is_integer():
        total_quantity = int(total_quantity)

    return jsonify({
        "crop_name": crop_name,
        "quality": quality,
        "hub_location": hub_location,
        "quantity": total_quantity,
        "indicative_price_per_qtl": prices_by_crop[crop_types[0].casefold()] if total_quantity and len(crop_types) == 1 else None,
        "crop_types": crop_types,
        "match_count": len(lots),
        "lots": lots
    }), 200


@app.route("/api/marketplace/purchase", methods=['POST'])
@require_roles('buyer')
def purchase_marketplace_stock():
    data = request.get_json() or {}
    crop_name = str(data.get("crop_name", "")).strip()
    quality = str(data.get("quality", "")).strip()
    hub_location = str(data.get("hub_location", "")).strip()
    destination_hub = str(data.get("destination_hub", "")).strip()
    clean_quality = quality if quality and quality.lower() not in ("all quality grades", "all", "") else None

    try:
        requested_quantity = round(float(data.get("quantity")), 2)
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid purchase quantity."}), 400

    if not crop_name or not hub_location or not destination_hub or not math.isfinite(requested_quantity) or requested_quantity <= 0:
        return jsonify({"error": "Crop, source hub, destination hub, and a positive purchase quantity are required."}), 400
    if not clean_quality:
        return jsonify({"error": "Choose a specific quality grade and search again before purchasing."}), 400

    user = current_user()
    buyer_id = user.id
    buyer_name = (user.user_metadata or {}).get('full_name') or user.email

    try:
        result = supabase.rpc("purchase_marketplace_stock", {
            "p_buyer_id": buyer_id,
            "p_buyer_name": buyer_name,
            "p_crop_name": crop_name,
            "p_quality_grade": clean_quality,
            "p_origin_hub": hub_location,
            "p_destination_hub": destination_hub,
            "p_quantity": requested_quantity,
        }).execute().data
        if isinstance(result, list):
            result = result[0] if result else None
        if not isinstance(result, dict) or not result.get("order") or not result.get("shipment"):
            raise RuntimeError("The database returned an incomplete purchase result.")

        return jsonify({
            "message": "Purchase request confirmed! Stock reserved and transport consignment generated.",
            "crop_name": crop_name,
            "quantity_purchased": requested_quantity,
            "remaining_stock": result["remaining_stock"],
            "order": result["order"],
            "shipment": result["shipment"]
        }), 200
    except Exception as e:
        if "INSUFFICIENT_STOCK" in str(e):
            return jsonify({"error": "That stock is no longer available in the requested quantity. Search again for the latest inventory."}), 409
        app.logger.exception("Marketplace purchase failed")
        return jsonify({"error": "The purchase could not be completed. Please try again."}), 500


@app.route("/api/buyer/orders", methods=['GET'])
@require_roles('buyer', 'agent')
def api_get_buyer_orders():
    user = current_user()
    query = supabase.table('orders').select('*').order('created_at', desc=True)
    if getattr(g, 'current_role', None) == 'buyer':
        query = query.eq('buyer_id', user.id)
    orders = query.execute().data or []
    return jsonify({"orders": orders}), 200


# ----------------------------------------------------
# Logistics & Transporter APIs
# ----------------------------------------------------
@app.route("/api/transporter/fleet", methods=['GET'])
@require_roles('transporter')
def api_get_transporter_fleet():
    user = current_user()
    vehicles = supabase.table('vehicles').select('*').eq('transporter_id', user.id).order('created_at', desc=True).execute().data or []
    return jsonify({"vehicles": vehicles}), 200


@app.route("/api/vehicle", methods=['POST'])
@require_roles('transporter')
def api_add_vehicle():
    user = current_user()
    data = request.get_json() or {}
    plate_number = str(data.get("plate_number", "")).strip()
    if not plate_number:
        return jsonify({"error": "Plate number is required."}), 400
    try:
        capacity_quintals = float(data.get("capacity_quintals") or 0)
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid vehicle capacity."}), 400

    vehicle_data = {
        "transporter_id": user.id,
        "plate_number": plate_number,
        "vehicle_type": str(data.get("vehicle_type") or "").strip(),
        "capacity_quintals": capacity_quintals,
        "driver_name": str(data.get("driver_name") or "").strip(),
        "phone_number": str(data.get("phone_number") or "").strip()
    }
    if not vehicle_data['vehicle_type'] or not math.isfinite(vehicle_data['capacity_quintals']) or vehicle_data['capacity_quintals'] <= 0 or not vehicle_data['driver_name'] or not vehicle_data['phone_number']:
        return jsonify({"error": "Vehicle type, positive capacity, driver name, and phone number are required."}), 400

    try:
        vehicle_data["status"] = "Pending Roadworthiness Approval"
        saved = supabase.table('vehicles').insert(vehicle_data).execute().data[0]

        return jsonify({
            "message": f"Vehicle {plate_number} registered! Submitted for roadworthiness inspection. Awaiting admin approval before route dispatch.",
            "data": saved
        }), 200
    except ValueError as ve:
        return jsonify({"error": str(ve)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/transporter/available-loads", methods=['GET'])
@require_roles('transporter')
def api_get_available_loads():
    shipments = supabase.table('shipments').select('*').eq('status', 'Ready for Carrier').neq('shipment_type', 'hub_supply').order('created_at').execute().data or []
    return jsonify({"loads": shipments}), 200


@app.route("/api/transporter/active-shipment", methods=['GET'])
@require_roles('transporter')
def api_get_active_shipment():
    user = current_user()
    try:
        supabase.rpc("assign_hub_supply_duties").execute()
    except Exception:
        app.logger.exception("Could not check queued hub replenishment duties")
    rows = supabase.table('shipments').select('*').eq('transporter_id', user.id).in_('status', ['Dispatched', 'Loaded & Weighed', 'In Transit', 'Awaiting Agent Approval', 'Delivery Issue - Admin Review']).order('created_at', desc=True).limit(1).execute().data or []
    shipment = rows[0] if rows else None
    return jsonify({"shipment": shipment}), 200


@app.route("/api/transporter/completed-history", methods=['GET'])
@require_roles('transporter')
def api_get_completed_history():
    user = current_user()
    shipments = supabase.table('shipments').select('*').eq('transporter_id', user.id).in_('status', ['Delivered & Offloaded', 'Delivered & Settled', 'Verified & Settled', 'Agent Approved - Complete', 'Admin Resolved - Complete', 'Cancelled by Admin']).order('created_at', desc=True).execute().data or []
    return jsonify({"completed": shipments}), 200


@app.route("/api/shipment/claim", methods=['POST'])
@require_roles('transporter')
def api_claim_shipment():
    data = request.get_json() or {}
    waybill_id = str(data.get("waybill_id") or "").strip()
    vehicle_plate = str(data.get("vehicle_plate") or "").strip()
    if not waybill_id or not vehicle_plate:
        return jsonify({"error": "A waybill and an approved vehicle are required."}), 400

    try:
        result = supabase.rpc("claim_available_shipment", {
            "p_transporter_id": current_user().id,
            "p_waybill_id": waybill_id,
            "p_vehicle_plate": vehicle_plate,
        }).execute()
        claimed = result.data if isinstance(result.data, dict) else {}
        return jsonify({
            "message": f"Route assignment for Waybill #{waybill_id} successfully claimed!",
            "shipment": claimed,
        }), 200
    except Exception as exc:
        message = str(exc)
        app.logger.exception("Transporter shipment claim failed")
        if "ACTIVE_TRIP_EXISTS" in message:
            return jsonify({"error": "Finish your active assignment before claiming another load."}), 409
        if "LOAD_UNAVAILABLE" in message:
            return jsonify({"error": "This load is no longer available."}), 409
        if "VEHICLE_NOT_APPROVED" in message:
            return jsonify({"error": "Select one of your vehicles approved for dispatch."}), 400
        if "VEHICLE_CAPACITY_TOO_SMALL" in message:
            return jsonify({"error": "The selected vehicle does not have enough capacity for this load."}), 400
        return jsonify({"error": "Could not claim this load. Refresh and try again."}), 400

@app.route("/api/shipment/update-status", methods=['POST'])
@require_roles('transporter')
def api_update_shipment_status():
    user = current_user()
    data = request.get_json() or {}
    waybill_id = data.get("waybill_id")
    try:
        stage_index = int(data.get("stage_index", 2))
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid shipment stage."}), 400
    stages = {2: "Loaded & Weighed", 3: "In Transit", 4: "Delivered & Offloaded"}
    if stage_index not in stages:
        return jsonify({"error": "Invalid shipment stage."}), 400
    status = stages[stage_index]

    try:
        shipment_result = supabase.table('shipments').select('*').eq('waybill_id', waybill_id).eq('transporter_id', user.id).maybe_single().execute()
        existing = shipment_result.data if shipment_result else None
        if not existing:
            return jsonify({"error": "Shipment not found or not assigned to you."}), 404
        if stage_index != int(existing.get('stage_index') or 0) + 1:
            return jsonify({"error": "Shipment stages must be completed in order."}), 409
        transfer_types = ("hub_transfer", "hub_supply")
        final_status = "Awaiting Agent Approval" if stage_index == 4 and existing.get("shipment_type") in transfer_types else status
        patch_data = {"status": final_status, "stage_index": stage_index}
        if stage_index == 4:
            patch_data["delivered_at"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        rows = supabase.table('shipments').update(patch_data).eq('waybill_id', waybill_id).eq('transporter_id', user.id).eq('stage_index', existing.get('stage_index') or 0).execute().data or []
        if not rows:
            return jsonify({"error": "Shipment not found or not assigned to you."}), 404
        updated = rows[0]
        if stage_index == 4 and updated.get('shipment_type') in ("hub_transfer", "hub_supply"):
            approval_result = supabase.rpc("request_hub_transfer_approvals", {"p_waybill_id": waybill_id}).execute()
            if isinstance(approval_result.data, dict):
                updated.update(approval_result.data)
            updated["status"] = "Awaiting Agent Approval"
            return jsonify({"message": "Delivery recorded. Active agents assigned to the destination hub must approve this handover before the driver can depart.", "shipment": updated}), 200
        if stage_index == 4 and updated.get('vehicle_plate'):
            supabase.table('vehicles').update({'status': 'Available at Depot'}).eq('transporter_id', user.id).eq('plate_number', updated['vehicle_plate']).execute()
        if updated.get('order_id'):
            supabase.table('orders').update({'status': status}).eq('id', updated['order_id']).execute()
        if stage_index == 4:
            try:
                supabase.rpc("assign_hub_supply_duties").execute()
            except Exception:
                app.logger.exception("Could not assign queued hub replenishment duties after trip completion")

        return jsonify({
            "message": f"Waybill #{updated['waybill_id']} status updated to: {updated['status']}.",
            "shipment": updated
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


def nearby_hubs_for(hub_location):
    return HUB_NEIGHBORS.get(hub_location, [])


@app.route("/api/agent/supply-requests", methods=['GET'])
@require_roles('agent')
def api_agent_supply_requests():
    agent_id = current_user().id
    try:
        requests = supabase.table("hub_supply_requests").select("*").eq("requester_agent_id", agent_id).order("created_at", desc=True).limit(50).execute().data or []
        for item in requests:
            links = supabase.table("hub_supply_request_shipments").select("shipment_id,assigned_quantity,status").eq("request_id", item["id"]).order("created_at").execute().data or []
            item["shipments"] = []
            for link in links:
                result = supabase.table("shipments").select("waybill_id,status,transporter_name,vehicle_plate,origin_hub,destination_hub").eq("id", link["shipment_id"]).maybe_single().execute()
                if result and result.data:
                    item["shipments"].append({**link, "shipment": result.data})
        return jsonify({"requests": requests, "hub_location": (get_current_staff_account() or {}).get("hub_location")}), 200
    except Exception:
        app.logger.exception("Could not load hub supply requests")
        return jsonify({"error": "Hub supply requests are unavailable. Apply the latest Supabase schema and try again."}), 503


@app.route("/api/agent/supply-requests", methods=['POST'])
@require_roles('agent')
def api_agent_create_supply_request():
    staff = get_current_staff_account() or {}
    hub_location = staff.get("hub_location")
    if hub_location not in ETHIOPIAN_HUBS:
        return jsonify({"error": "Your account must be assigned to a valid hub before requesting supply."}), 403
    data = request.get_json() or {}
    crop_type = str(data.get("crop_type") or "").strip()
    quality_grade = str(data.get("quality_grade") or "").strip()
    try:
        quantity = float(data.get("quantity"))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid requested quantity."}), 400
    if not crop_type or quality_grade not in ('Grade 1 (Magna / Premium)', 'Grade 1 (Standard)', 'Grade 2 Commercial', 'Export Quality Verified') or not math.isfinite(quantity) or quantity <= 0:
        return jsonify({"error": "Choose a crop, quality, and positive quantity."}), 400
    sources = nearby_hubs_for(hub_location)
    if not sources:
        return jsonify({"error": "No nearby source hubs are configured for your hub yet."}), 409
    try:
        created = supabase.rpc("create_hub_supply_request", {
            "p_agent_id": current_user().id,
            "p_crop_type": crop_type,
            "p_quality_grade": quality_grade,
            "p_quantity": quantity,
            "p_destination_hub": hub_location,
            "p_source_hubs": sources,
            "p_min_reserve_qtl": HUB_MIN_RESERVE_QTL,
            "p_rate_per_qtl": TRANSPORT_RATE_ETB_PER_QTL,
        }).execute().data
        request_result = created if isinstance(created, dict) else {}
        try:
            supabase.rpc("assign_hub_supply_duties").execute()
        except Exception:
            app.logger.exception("Supply request saved, but automatic carrier assignment will retry when a vehicle is approved or freed")
        return jsonify({"message": "Supply request placed. The closest stocked neighboring hub was checked, and the quantity was split into vehicle-sized trips. Eligible carriers are assigned fairly as they become free.", "supply_request": request_result}), 201
    except Exception as exc:
        message = str(exc)
        app.logger.exception("Could not create hub supply request")
        if "INSUFFICIENT_NEARBY_STOCK" in message:
            return jsonify({"error": "Nearby hubs do not have enough available stock after their minimum reserve is protected."}), 409
        if "NO_ACTIVE_AGENT" in message:
            return jsonify({"error": "No active agent is assigned to your hub. Ask an administrator to assign one."}), 409
        return jsonify({"error": "Could not create the supply request. Confirm the latest Supabase schema is installed and try again."}), 400


@app.route("/api/agent/transfer-approvals", methods=['GET'])
@require_roles('agent')
def api_agent_transfer_approvals():
    agent_id = current_user().id
    assigned_hub = (get_current_staff_account() or {}).get("hub_location")
    rows = supabase.table("shipment_agent_approvals").select("*").eq("agent_id", agent_id).order("requested_at", desc=True).execute().data or []
    shipments = {}
    for approval in rows:
        shipment_id = approval.get("shipment_id")
        if shipment_id not in shipments:
            result = supabase.table("shipments").select("*").eq("id", shipment_id).maybe_single().execute()
            shipments[shipment_id] = result.data if result else None
        shipment = shipments[shipment_id]
        if not shipment or shipment.get("destination_hub") != assigned_hub or int(approval.get("attempt_no") or 1) != int(shipment.get("transfer_attempt") or 1):
            continue
        approval["shipment"] = shipment
    rows = [approval for approval in rows if approval.get("shipment")]
    return jsonify({"approvals": rows}), 200


@app.route("/api/agent/transfer-approval", methods=['POST'])
@require_roles('agent')
def api_agent_transfer_approval():
    data = request.get_json() or {}
    approval_id = str(data.get("approval_id") or "").strip()
    approved = data.get("approved") is True
    reason = str(data.get("reason") or "").strip()
    if not approval_id:
        return jsonify({"error": "Approval record is required."}), 400
    if not approved and not reason:
        return jsonify({"error": "Enter a reason when reporting a delivery problem."}), 400
    try:
        result = supabase.rpc("respond_to_hub_transfer_approval", {
            "p_approval_id": approval_id,
            "p_agent_id": current_user().id,
            "p_approved": approved,
            "p_reason": reason or None,
        }).execute()
        try:
            supabase.rpc("assign_hub_supply_duties").execute()
        except Exception:
            app.logger.exception("Could not assign the next queued hub replenishment duty")
        return jsonify({"message": "Delivery approval recorded.", "result": result.data}), 200
    except Exception as exc:
        app.logger.exception("Transfer delivery approval failed")
        return jsonify({"error": str(exc)}), 400


# ----------------------------------------------------
# Admin Oversight APIs
# ----------------------------------------------------
@app.route("/api/admin/pending-users", methods=['GET'])
@require_roles('admin')
def api_get_pending_users():
    users = []
    for role in ('agent', 'buyer', 'transporter'):
        rows = supabase.table(f'{role}s').select('*').eq('verified', False).order('created_at', desc=True).execute().data or []
        users.extend([{**row, 'role': role} for row in rows])
    return jsonify({"users": users}), 200


@app.route("/api/admin/stats", methods=['GET'])
@require_roles('admin')
def api_get_admin_stats():
    farmers = supabase.table('farmers').select('id', count='exact').execute()
    # Count only produce that is physically available in a hub silo. Historical,
    # sold, dispatched, and zero-quantity lot rows are not current inventory.
    lots = supabase.table('produce_lots').select('quantity').eq('status', 'In Hub Silo').gt('quantity', 0).execute().data or []
    orders = supabase.table('orders').select('total_price').execute().data or []
    profiles = []
    for role in ('buyer', 'transporter'):
        profiles.extend(supabase.table(f'{role}s').select('id,verified').execute().data or [])
    stats = {
        'total_users': len(profiles),
        'pending_verifications': sum(1 for p in profiles if not p.get('verified')),
        'hub_buffer_stock': sum(float(l.get('quantity') or 0) for l in lots),
        'total_trade_settled_etb': sum(float(o.get('total_price') or 0) for o in orders),
        'total_farmers': farmers.count or 0
    }
    return jsonify({"stats": stats}), 200


@app.route("/api/admin/crop-prices", methods=['GET'])
@require_roles('admin')
def api_admin_list_crop_prices():
    try:
        rows = supabase.table('crop_prices').select('crop_type,fixed_price_per_qtl,active,updated_at').order('crop_type').execute().data or []
        return jsonify({"crop_prices": rows}), 200
    except Exception:
        app.logger.exception("Could not load crop prices")
        return jsonify({"error": "Crop prices could not be loaded. Confirm the crop price migration has been run."}), 503


@app.route("/api/admin/crop-prices", methods=['POST'])
@require_roles('admin')
def api_admin_save_crop_price():
    data = request.get_json() or {}
    crop_type = str(data.get('crop_type') or '').strip()
    active = data.get('active', True) is True
    if not crop_type or len(crop_type) > 100:
        return jsonify({"error": "Enter a crop name of 1 to 100 characters."}), 400
    try:
        rate = float(data.get('fixed_price_per_qtl'))
    except (TypeError, ValueError):
        rate = None
    if active and (rate is None or not math.isfinite(rate) or rate <= 0):
        return jsonify({"error": "Enter a positive fixed price per quintal."}), 400
    try:
        current = supabase.table('crop_prices').select('crop_type').execute().data or []
        match = next((row for row in current if row['crop_type'].casefold() == crop_type.casefold()), None)
        canonical_crop = match['crop_type'] if match else crop_type
        payload = {
            'crop_type': canonical_crop,
            'fixed_price_per_qtl': rate if active else (float(data.get('fixed_price_per_qtl') or 0)),
            'active': active,
            'updated_by': current_user().id,
            'updated_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        }
        result = supabase.table('crop_prices').upsert(payload, on_conflict='crop_type').execute().data or []
        return jsonify({"message": f"Fixed price for {canonical_crop} saved.", "crop_price": result[0] if result else payload}), 200
    except Exception as exc:
        app.logger.exception("Could not save crop price")
        return jsonify({"error": "Could not save crop price. Check the database migration and try again."}), 400


@app.route("/api/admin/delivery-issues", methods=['GET'])
@require_roles('admin')
def api_admin_delivery_issues():
    rows = supabase.table("shipment_agent_approvals").select("*").eq("status", "rejected").order("responded_at", desc=True).execute().data or []
    shipments = {}
    agents = {}
    for item in rows:
        sid, aid = item.get("shipment_id"), item.get("agent_id")
        if sid not in shipments:
            result = supabase.table("shipments").select("*").eq("id", sid).maybe_single().execute()
            shipments[sid] = result.data if result else None
        if aid not in agents:
            result = supabase.table("staff_accounts").select("full_name,username").eq("id", aid).maybe_single().execute()
            agents[aid] = result.data if result else None
        item["shipment"] = shipments[sid]
        item["agent"] = agents[aid]
    rows = [item for item in rows if item.get("shipment") and item["shipment"].get("status") == "Delivery Issue - Admin Review"]
    grouped = {}
    for item in rows:
        shipment = item.get("shipment") or {}
        shipment_id = shipment.get("id") or item.get("shipment_id")
        if shipment_id not in grouped:
            grouped[shipment_id] = {"shipment": shipment, "reports": []}
        grouped[shipment_id]["reports"].append({"reason": item.get("reason"), "responded_at": item.get("responded_at"), "agent": item.get("agent"), "attempt_no": item.get("attempt_no", 1)})
    issues = list(grouped.values())
    for issue in issues:
        issue["reports"].sort(key=lambda report: report.get("responded_at") or "", reverse=True)
    return jsonify({"issues": issues}), 200


@app.route("/api/admin/agents", methods=['GET'])
@require_roles('admin')
def api_admin_list_agents():
    agents = supabase.table("staff_accounts").select("id,username,full_name,hub_location,active").eq("role", "agent").order("full_name").execute().data or []
    return jsonify({"agents": agents}), 200


def refresh_pending_transfer_approvals(hub_location):
    outstanding = supabase.table("shipments").select("waybill_id").in_("shipment_type", ["hub_transfer", "hub_supply"]).eq("destination_hub", hub_location).eq("status", "Awaiting Agent Approval").execute().data or []
    for shipment in outstanding:
        try:
            supabase.rpc("request_hub_transfer_approvals", {"p_waybill_id": shipment["waybill_id"]}).execute()
        except Exception:
            app.logger.exception("Could not refresh hub delivery approvals")


@app.route("/api/admin/agents/<staff_id>/hub", methods=['POST'])
@require_roles('admin')
def api_admin_assign_agent_hub(staff_id):
    data = request.get_json() or {}
    hub_location = str(data.get("hub_location") or "").strip()
    if hub_location not in ETHIOPIAN_HUBS:
        return jsonify({"error": "Choose a valid hub location."}), 400
    rows = supabase.table("staff_accounts").update({"hub_location": hub_location}).eq("id", staff_id).eq("role", "agent").execute().data or []
    if not rows:
        return jsonify({"error": "Agent account not found."}), 404
    refresh_pending_transfer_approvals(hub_location)
    return jsonify({"message": f"{rows[0]['full_name']} is assigned to {hub_location}.", "agent": rows[0]}), 200


@app.route("/api/admin/resolve-delivery-issue", methods=['POST'])
@require_roles('admin')
def api_admin_resolve_delivery_issue():
    data = request.get_json() or {}
    waybill_id = str(data.get("waybill_id") or "").strip()
    action = str(data.get("action") or "").strip().lower()
    note = str(data.get("note") or "").strip()
    if not waybill_id or action not in ("complete", "retry", "cancel"):
        return jsonify({"error": "Choose a delivery issue and a valid resolution action."}), 400
    if len(note) < 5:
        return jsonify({"error": "Enter an admin resolution note of at least five characters."}), 400
    try:
        result = supabase.rpc("resolve_hub_transfer_issue", {
            "p_waybill_id": waybill_id,
            "p_action": action,
            "p_admin_id": current_user().id,
            "p_note": note,
        }).execute()
        try:
            supabase.rpc("assign_hub_supply_duties").execute()
        except Exception:
            app.logger.exception("Could not assign the next queued hub replenishment duty")
        return jsonify({"message": f"Transfer {waybill_id} resolution recorded: {action}.", "result": result.data}), 200
    except Exception as exc:
        app.logger.exception("Admin transfer resolution failed")
        return jsonify({"error": str(exc)}), 400


@app.route("/api/admin/verify-user", methods=['POST'])
@require_roles('admin')
def api_verify_user():
    data = request.get_json() or {}
    user_id = data.get("user_id")
    role = data.get("role") or "agent"
    verified = bool(data.get("verified", True))

    if role not in ('agent', 'buyer', 'transporter') or not user_id:
        return jsonify({"error": "A valid profile and role are required."}), 400
    updated_rows = supabase.table(f"{role}s").update({'verified': verified}).eq('id', user_id).execute().data or []
    if not updated_rows:
        return jsonify({"error": "Profile not found."}), 404
    updated = updated_rows[0]

    return jsonify({
        "message": f"User {user_id} ({role}) successfully {'verified' if verified else 'suspended'}.",
        "user": updated
    }), 200


@app.route("/api/admin/pending-vehicles", methods=['GET'])
@require_roles('admin')
def api_get_pending_vehicles():
    vehicles = supabase.table('vehicles').select('*').eq('status', 'Pending Roadworthiness Approval').order('created_at', desc=True).execute().data or []
    return jsonify({"vehicles": vehicles}), 200


@app.route("/api/admin/verify-vehicle", methods=['POST'])
@require_roles('admin')
def api_verify_vehicle():
    data = request.get_json() or {}
    vehicle_id = data.get("vehicle_id")
    approved = bool(data.get("approved", True))

    try:
        if not vehicle_id:
            return jsonify({"error": "Vehicle ID is required."}), 400
        status = 'Approved for Hub Dispatch' if approved else 'Inspection Rejected / Grounded'
        rows = supabase.table('vehicles').update({'status': status, 'approved': approved}).eq('id', vehicle_id).execute().data or []
        if not rows:
            return jsonify({"error": "Vehicle not found."}), 404
        updated = rows[0]
        if approved:
            try:
                supabase.rpc("assign_hub_supply_duties").execute()
            except Exception:
                app.logger.exception("Could not assign queued hub replenishment duties after vehicle approval")

        status_str = "Approved for Hub Dispatch" if approved else "Rejected / Grounded"
        return jsonify({
            "message": f"Vehicle {updated.get('plate_number')} roadworthiness status updated: {status_str}.",
            "vehicle": updated
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/admin/staff", methods=['POST'])
@require_roles('admin')
def api_admin_create_staff():
    data = request.get_json() or {}
    full_name = str(data.get("full_name", "")).strip()
    username = str(data.get("username", "")).strip().lower()
    password = str(data.get("password", ""))
    role = str(data.get("role", "")).strip().lower()
    hub_location = str(data.get("hub_location", "")).strip()
    company_name = str(data.get("company_name", "")).strip() or None
    license_ref = str(data.get("license_ref", "")).strip()

    if not full_name or not username or role not in ("agent", "transporter"):
        return jsonify({"error": "Full name, staff login name, and a valid staff role are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Set a password with at least 8 characters."}), 400
    if role == "agent" and hub_location not in ETHIOPIAN_HUBS:
        return jsonify({"error": "Choose the hub this agent is assigned to."}), 400

    try:
        # maybe_single() returns None when the login name is new; access its
        # .data only when a row exists. A limited list is predictable here.
        existing = supabase.table("staff_accounts").select("id").eq("username", username).limit(1).execute().data or []
        if existing:
            return jsonify({"error": "That staff login name is already in use."}), 409
        staff_id = str(uuid.uuid4())
        account = supabase.table("staff_accounts").insert({
            "id": staff_id, "username": username, "full_name": full_name,
            "role": role, "password_hash": generate_password_hash(password), "active": True,
            "hub_location": hub_location if role == "agent" else None
        }).execute().data[0]
        profile_table = "agents" if role == "agent" else "transporters"
        profile_payload = {
            "auth_user_id": staff_id, "full_name": full_name, "verified": True,
            "email": None, "license_ref": license_ref or None
        }
        if role == "agent":
            profile_payload["cooperative"] = company_name
        else:
            profile_payload["company_name"] = company_name
        try:
            supabase.table(profile_table).insert(profile_payload).execute()
        except Exception:
            supabase.table("staff_accounts").delete().eq("id", staff_id).execute()
            raise
        if role == "agent":
            refresh_pending_transfer_approvals(hub_location)
        return jsonify({
            "message": f"{role.title()} account for '{full_name}' created. They can sign in at /staff/login.",
            "staff": {"id": account["id"], "username": account["username"], "full_name": account["full_name"], "role": account["role"], "hub_location": account.get("hub_location")}
        }), 200
    except Exception as e:
        if "duplicate key" in str(e).lower() or "unique" in str(e).lower():
            return jsonify({"error": "That staff login name is already in use."}), 409
        app.logger.exception("Admin staff account creation failed")
        return jsonify({"error": str(e)}), 400


if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(port=3000, debug=True, host='0.0.0.0')
