-- ========================================================
-- AgriBridge Database Schema for Supabase (PostgreSQL)
-- Run this script in the Supabase SQL Editor
-- ========================================================

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users / Profiles
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    full_name TEXT NOT NULL,
    email TEXT,
    phone_number TEXT,
    cooperative TEXT DEFAULT 'Ada''a Farmers Cooperative',
    hub_location TEXT DEFAULT 'Bishoftu / Ada''a Hub',
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.buyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    full_name TEXT NOT NULL,
    company_name TEXT,
    email TEXT,
    phone_number TEXT,
    tin_number TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transporters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    full_name TEXT NOT NULL,
    company_name TEXT,
    email TEXT,
    phone_number TEXT,
    license_number TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Farmers Table
CREATE TABLE IF NOT EXISTS public.farmers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    kebele_id TEXT UNIQUE NOT NULL,
    gender TEXT DEFAULT 'male',
    region TEXT DEFAULT 'oromia',
    woreda TEXT DEFAULT 'Bishoftu / Ada''a',
    kebele TEXT DEFAULT 'Kebele 04 Rural',
    land_size_hectares NUMERIC DEFAULT 1.0,
    water_source TEXT DEFAULT 'rain_fed',
    harvests_per_year INT DEFAULT 1,
    primary_crop TEXT DEFAULT 'White Teff',
    cooperative TEXT,
    payout_method TEXT DEFAULT 'cbe_bank',
    account_number TEXT,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Produce Lots Table
CREATE TABLE IF NOT EXISTS public.produce_lots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_ref TEXT UNIQUE,
    agent_id UUID,
    farmer_kebele_id TEXT REFERENCES public.farmers(kebele_id) ON UPDATE CASCADE ON DELETE SET NULL,
    crop_type TEXT NOT NULL,
    quality_grade TEXT DEFAULT 'Grade 1 (Standard)',
    quantity NUMERIC NOT NULL DEFAULT 0,
    initial_quantity NUMERIC NOT NULL DEFAULT 0,
    hub_location TEXT DEFAULT 'Bishoftu Hub',
    harvest_date DATE DEFAULT CURRENT_DATE,
    price_per_qtl NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'In Hub Silo', -- 'In Hub Silo', 'Reserved', 'Dispatched', 'Sold'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Buyer Orders / Trades Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_ref TEXT UNIQUE NOT NULL,
    buyer_id UUID,
    buyer_name TEXT,
    crop_type TEXT NOT NULL,
    quality_grade TEXT,
    quantity NUMERIC NOT NULL,
    unit_price NUMERIC NOT NULL,
    total_price NUMERIC NOT NULL,
    hub_location TEXT DEFAULT 'Bishoftu Hub',
    status TEXT DEFAULT 'Confirmed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Shipments & Logistics Waybills Table
CREATE TABLE IF NOT EXISTS public.shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    waybill_id TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    crop_type TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    origin_hub TEXT NOT NULL,
    destination_hub TEXT NOT NULL,
    transporter_id UUID,
    transporter_name TEXT,
    vehicle_plate TEXT,
    tariff_etb NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Ready for Carrier', -- 'Ready for Carrier', 'Dispatched', 'Loaded & Weighed', 'In Transit', 'Delivered & Settled'
    stage_index INT DEFAULT 0, -- 0: Ready, 1: Dispatched, 2: Loaded, 3: In Transit, 4: Delivered
    claimed_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Vehicles Fleet Table
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transporter_id UUID,
    plate_number TEXT UNIQUE NOT NULL,
    vehicle_type TEXT DEFAULT 'Isuzu FSR',
    capacity_quintals NUMERIC DEFAULT 100,
    driver_name TEXT DEFAULT 'Primary Driver',
    phone_number TEXT,
    status TEXT DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Benchmark Prices Oracle Table
CREATE TABLE IF NOT EXISTS public.prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_type TEXT UNIQUE NOT NULL,
    indicative_rate_etb NUMERIC NOT NULL,
    floor_rate_etb NUMERIC NOT NULL,
    ceiling_rate_etb NUMERIC NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert baseline Ethiopian market benchmark prices
INSERT INTO public.prices (crop_type, indicative_rate_etb, floor_rate_etb, ceiling_rate_etb)
VALUES
    ('White Teff', 11500, 10800, 12200),
    ('Bread Wheat', 5200, 4800, 5600),
    ('Yellow Maize', 3750, 3400, 4100),
    ('Humera Sesame', 16800, 15500, 18000),
    ('Malt Barley', 6200, 5800, 6600),
    ('Red Kidney Beans', 6800, 6200, 7300),
    ('Coffee Arabica', 24000, 22000, 26500)
ON CONFLICT (crop_type) DO NOTHING;
