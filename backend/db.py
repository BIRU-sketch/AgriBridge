from supabase import create_client, Client
from dotenv import load_dotenv
import os
load_dotenv()

class Database:
    def __init__(self):
        url: str = os.getenv("SUPABASE_URL")
        key: str = os.getenv("SUPABASE_KEY")
        self.supabase: Client = create_client(url=url, key=key)
    def register_farmer(self, farmer_data: dict):
        return self.supabase.table('farmers').insert(farmer_data).execute()

    def register_agent(self, agent_data: dict):
        return self.supabase.table('agents').insert(agent_data).execute()

    def register_buyer(self, buyer_data: dict):
        return self.supabase.table('buyers').insert(buyer_data).execute()

    def register_transporter(self, transporter_data: dict):
        return self.supabase.table('transporters').insert(transporter_data).execute()

    def verify_user(self, table: str, user_id: str, verified: bool = True):
        return self.supabase.table(table).update({'verified': verified}).eq('id', user_id).execute()

    def get_user(self, table: str, user_id: str):
        return self.supabase.table(table).select('*').eq('id', user_id).execute()

    def add_produce_lot(self, lot_data: dict):
        return self.supabase.table('produce_lots').insert(lot_data).execute()

    def get_produce_lots(self, agent_id: str = None):
        query = self.supabase.table('produce_lots').select('*')
        if agent_id:
            query = query.eq('agent_id', agent_id)
        return query.execute()

    def get_produce_lot(self, lot_id: str):
        return self.supabase.table('produce_lots').select('*').eq('id', lot_id).execute()

    def post_demand(self, demand_data: dict):
        return self.supabase.table('demands').insert(demand_data).execute()

    def get_demands(self, buyer_id: str = None):
        query = self.supabase.table('demands').select('*')
        if buyer_id:
            query = query.eq('buyer_id', buyer_id)
        return query.execute()

    def get_demand(self, demand_id: str):
        return self.supabase.table('demands').select('*').eq('id', demand_id).execute()

    def add_vehicle(self, vehicle_data: dict):
        return self.supabase.table('vehicles').insert(vehicle_data).execute()

    def get_vehicles(self, transporter_id: str):
        return self.supabase.table('vehicles').select('*').eq('transporter_id', transporter_id).execute()