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
                "data": {"full_name": data.get("full_name")}
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
    return render_template('dashboard.html')

if __name__ == '__main__':
    app.run(port=3000, debug=True)