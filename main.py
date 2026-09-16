from flask import Flask, render_template, request, jsonify, redirect, url_for, make_response
from supabase import create_client, Client
import os
from dotenv import load_dotenv
load_dotenv()

app = Flask(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
@app.route('/')
def home():
    return render_template('homepage.html')
@app.route('/auth')
def auth_page():
    return render_template('auth.html')
@app.route('/api/signup', methods=['POST'])
def api_signup():
    data = request.get_json()
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
        return jsonify({"message": "Signup successful!", "user_id": response.user.id}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    try:
        response = supabase.auth.sign_in_with_password({
            "email": data.get("email"),
            "password": data.get("password")
        })
        access_token = response.session.access_token
        res = make_response(jsonify({"message": "Login successful!"}))
        res.set_cookie('access_token', access_token, httponly=True)
        return res, 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400
@app.route('/dashboard')
def dashboard():
    token = request.cookies.get('access_token')
    if not token:
        return redirect('/auth')
    response = supabase.auth.get_user(token)
    user = response.user
    role = user.user_metadata.get('role') if user else None
    if role == 'agent':
        return render_template('agent_dashboard.html')
    elif role == 'buyer':
        return render_template('buyer_dashboard.html', username=user.user_metadata.get('full_name'))
    elif role == 'transporter':
        
        return render_template('transporter_dashboard.html', username=user.user_metadata.get('full_name'))
    elif role == 'admin':
        return render_template('admin_dashboard.html')
    else:
        return render_template('dashboard.html')
@app.route("/register-farmer")
def register_farmer():
    return render_template("register-farmer.html")

@app.route("/add-produce-lot")
def add_produce_lot():
    return render_template("add-produce-lot.html")

@app.route("/api/register-farmer", methods=['POST'])
def api_register_farmer():
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
    data = request.get_json()
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

    try:
        query = supabase.table('produce_lots').select('crop_type, quantity').ilike('crop_type', crop_name)
        if quality:
            query = query.eq('quality_grade', quality)

        response = query.execute()
        total_quantity = sum(float(lot.get('quantity') or 0) for lot in response.data or [])
        if total_quantity.is_integer():
            total_quantity = int(total_quantity)

        return jsonify({
            "crop_name": crop_name,
            "quality": quality,
            "quantity": total_quantity,
            "match_count": len(response.data or [])
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/api/marketplace/purchase", methods=['POST'])
def purchase_marketplace_stock():
    data = request.get_json() or {}
    crop_name = str(data.get("crop_name", "")).strip()
    quality = str(data.get("quality", "")).strip()

    try:
        requested_quantity = float(data.get("quantity"))
    except (TypeError, ValueError):
        return jsonify({"error": "Enter a valid purchase quantity."}), 400

    if not crop_name or requested_quantity <= 0:
        return jsonify({"error": "Crop name and a positive purchase quantity are required."}), 400

    try:
        query = supabase.table('produce_lots').select('id, crop_type, quantity').ilike('crop_type', crop_name)
        if quality:
            query = query.eq('quality_grade', quality)

        lots = query.execute().data or []
        lots_with_quantity = [
            lot for lot in lots if float(lot.get('quantity') or 0) > 0
        ]
        total_quantity = sum(float(lot.get('quantity') or 0) for lot in lots_with_quantity)

        if total_quantity < requested_quantity:
            return jsonify({
                "error": f"Only {total_quantity:g} is available in stock."
            }), 409

        first_lot = lots_with_quantity[0] if lots_with_quantity else None
        suitable_lot = (
            first_lot
            if first_lot and float(first_lot.get('quantity') or 0) >= requested_quantity
            else None
        )

        if suitable_lot:
            lots_to_update = [(suitable_lot, requested_quantity)]
        else:
            lots_to_update = []
            remaining_quantity = requested_quantity
            for lot in sorted(
                lots_with_quantity,
                key=lambda item: float(item.get('quantity') or 0),
                reverse=True
            ):
                deduction = min(float(lot.get('quantity') or 0), remaining_quantity)
                lots_to_update.append((lot, deduction))
                remaining_quantity -= deduction
                if remaining_quantity <= 0:
                    break

        for lot, deduction in lots_to_update:
            new_quantity = float(lot.get('quantity') or 0) - deduction
            if new_quantity.is_integer():
                new_quantity = int(new_quantity)
            supabase.table('produce_lots').update({
                'quantity': new_quantity
            }).eq('id', lot['id']).execute()

        remaining_stock = total_quantity - requested_quantity
        if remaining_stock.is_integer():
            remaining_stock = int(remaining_stock)

        return jsonify({
            "message": "Purchase request confirmed.",
            "crop_name": crop_name,
            "quantity_purchased": requested_quantity,
            "remaining_stock": remaining_stock
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

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

if __name__ == '__main__':
    app.run(port=3000, debug=True)