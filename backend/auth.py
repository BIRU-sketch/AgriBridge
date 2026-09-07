import supabase
import os
from dotenv import load_dotenv
load_dotenv()
from flask import jsonify

class authentication:
    def __init__(self):
        url: str = os.getenv("SUPABASE_URL")
        key: str = os.getenv("SUPABASE_KEY")
        self.supabase: supabase.Client = supabase.create_client(url, key)
    def sign_up(self, email: str, password: str, full_name: str):
        response = self.supabase.auth.sign_up({
            "email":email,
            "password":password,
            "options":{
                "data":{
                    "full_name": full_name
                }
            }
        })
        
        return {"access_token": "em", "message": "User registered"}
    def sign_in(self, email: str, password: str):
        try:
            response = self.supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
                })
        except Exception as e:
            return jsonify({"error": str(e)}), 400
        aal = self.supabase.auth.mfa.get_authenticator_assurance_level()
        if aal.next_level == 'aal2' and aal.current_level == 'aal1':
            factors = self.supabase.auth.mfa.list_factors()
            if not factors.totp:
                return jsonify({"error": "No TOTP factor found"}), 400
            factor_id = factors.totp[0].id
            return jsonify({
                "mfa_required": True,
                "factor_id": factor_id,"message": "Please enter your 6-digit authenticator code"
        }), 200
        return jsonify({
            "message": "Login successful", 
            "user": response.user.id
            }), 200