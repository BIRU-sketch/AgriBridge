-- ============================================================================
-- AgriBridge - Supabase Database Schema & Migration Script
-- Copy and paste this file into your Supabase Dashboard -> SQL Editor and Run.
-- ============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. FARMERS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.farmers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID,
    full_name TEXT,
    phone_number TEXT,
    kebele_id TEXT,
    gender TEXT DEFAULT 'male',
    region TEXT DEFAULT 'oromia',
    woreda TEXT DEFAULT 'Bishoftu / Ada''a',
    kebele TEXT DEFAULT 'Kebele 04 Rural',
    land_size_hectares NUMERIC DEFAULT 1.0,
    water_source TEXT DEFAULT 'rain_fed',
    harvests_per_year INTEGER DEFAULT 1,
    primary_crop TEXT DEFAULT 'White Teff',
    cooperative TEXT DEFAULT 'Ada''a Multi-Purpose Farmers Cooperative',
    payout_method TEXT DEFAULT 'cbe_bank',
    account_number TEXT,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely rename legacy columns in farmers if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmers' AND column_name='name') THEN
        ALTER TABLE public.farmers RENAME COLUMN name TO full_name;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmers' AND column_name='phone') THEN
        ALTER TABLE public.farmers RENAME COLUMN phone TO phone_number;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmers' AND column_name='land_size') THEN
        ALTER TABLE public.farmers RENAME COLUMN land_size TO land_size_hectares;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmers' AND column_name='harvests') THEN
        ALTER TABLE public.farmers RENAME COLUMN harvests TO harvests_per_year;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmers' AND column_name='crop') THEN
        ALTER TABLE public.farmers RENAME COLUMN crop TO primary_crop;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='farmers' AND column_name='payment_method') THEN
        ALTER TABLE public.farmers RENAME COLUMN payment_method TO payout_method;
    END IF;
END $$;

-- Ensure all columns exist on farmers
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS kebele_id TEXT;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'oromia';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS woreda TEXT DEFAULT 'Bishoftu / Ada''a';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS kebele TEXT DEFAULT 'Kebele 04 Rural';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS land_size_hectares NUMERIC DEFAULT 1.0;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS water_source TEXT DEFAULT 'rain_fed';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS harvests_per_year INTEGER DEFAULT 1;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS primary_crop TEXT DEFAULT 'White Teff';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS cooperative TEXT DEFAULT 'Ada''a Multi-Purpose Farmers Cooperative';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS payout_method TEXT DEFAULT 'cbe_bank';
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS account_number TEXT;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE;
ALTER TABLE public.farmers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_farmers_kebele_id_uniq ON public.farmers(kebele_id) WHERE kebele_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 2. PRODUCE LOTS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.produce_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID,
    farmer_kebele_id TEXT,
    crop_type TEXT,
    quality_grade TEXT DEFAULT 'Grade 1 (Standard)',
    quantity NUMERIC DEFAULT 0,
    harvest_date DATE DEFAULT CURRENT_DATE,
    price_per_qtl NUMERIC DEFAULT 5000,
    hub_location TEXT DEFAULT 'Bishoftu Hub',
    status TEXT DEFAULT 'In Hub Silo',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely rename legacy columns in produce_lots if present
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produce_lots' AND column_name='crop') THEN
        ALTER TABLE public.produce_lots RENAME COLUMN crop TO crop_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produce_lots' AND column_name='crop_name') THEN
        ALTER TABLE public.produce_lots RENAME COLUMN crop_name TO crop_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produce_lots' AND column_name='quality') THEN
        ALTER TABLE public.produce_lots RENAME COLUMN quality TO quality_grade;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produce_lots' AND column_name='volume') THEN
        ALTER TABLE public.produce_lots RENAME COLUMN volume TO quantity;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produce_lots' AND column_name='farmer_id') THEN
        ALTER TABLE public.produce_lots RENAME COLUMN farmer_id TO farmer_kebele_id;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='produce_lots' AND column_name='price') THEN
        ALTER TABLE public.produce_lots RENAME COLUMN price TO price_per_qtl;
    END IF;
END $$;

-- Ensure all columns exist on produce_lots
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS agent_id UUID;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS farmer_kebele_id TEXT;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS crop_type TEXT;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS quality_grade TEXT DEFAULT 'Grade 1 (Standard)';
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS harvest_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS price_per_qtl NUMERIC DEFAULT 5000;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS hub_location TEXT DEFAULT 'Bishoftu Hub';
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'In Hub Silo';
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_produce_crop_type ON public.produce_lots(crop_type);
CREATE INDEX IF NOT EXISTS idx_produce_quantity ON public.produce_lots(quantity);
CREATE INDEX IF NOT EXISTS idx_produce_harvest_date ON public.produce_lots(harvest_date);

-- ----------------------------------------------------------------------------
-- 3. DEMANDS TABLE (Buyer Demands & Confirmed Orders)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.demands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    buyer_id UUID,
    crop_type TEXT,
    quality_grade TEXT DEFAULT 'Grade 1 (Standard)',
    quantity NUMERIC DEFAULT 0,
    target_location TEXT DEFAULT 'Bishoftu Hub',
    target_date DATE DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
    max_price NUMERIC,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely rename legacy columns in demands
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='demands' AND column_name='crop') THEN
        ALTER TABLE public.demands RENAME COLUMN crop TO crop_type;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='demands' AND column_name='quality') THEN
        ALTER TABLE public.demands RENAME COLUMN quality TO quality_grade;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='demands' AND column_name='volume') THEN
        ALTER TABLE public.demands RENAME COLUMN volume TO quantity;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='demands' AND column_name='location') THEN
        ALTER TABLE public.demands RENAME COLUMN location TO target_location;
    END IF;
END $$;

-- Ensure all columns exist on demands
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS buyer_id UUID;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS crop_type TEXT;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS quality_grade TEXT DEFAULT 'Grade 1 (Standard)';
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS target_location TEXT DEFAULT 'Bishoftu Hub';
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS target_date DATE DEFAULT (CURRENT_DATE + INTERVAL '14 days');
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS max_price NUMERIC;
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- 4. VEHICLES TABLE (Transporter Commercial Fleet)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transporter_id UUID,
    plate_number TEXT,
    vehicle_type TEXT DEFAULT 'Isuzu FSR Medium Truck',
    capacity_quintals NUMERIC DEFAULT 120,
    driver_name TEXT,
    phone_number TEXT,
    status TEXT DEFAULT 'Available at Hub',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely rename legacy columns in vehicles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehicles' AND column_name='plate') THEN
        ALTER TABLE public.vehicles RENAME COLUMN plate TO plate_number;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehicles' AND column_name='capacity') THEN
        ALTER TABLE public.vehicles RENAME COLUMN capacity TO capacity_quintals;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vehicles' AND column_name='type') THEN
        ALTER TABLE public.vehicles RENAME COLUMN type TO vehicle_type;
    END IF;
END $$;

-- Ensure all columns exist on vehicles
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS transporter_id UUID;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS plate_number TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS vehicle_type TEXT DEFAULT 'Isuzu FSR Medium Truck';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS capacity_quintals NUMERIC DEFAULT 120;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS driver_name TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Available at Hub';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_plate_uniq ON public.vehicles(plate_number) WHERE plate_number IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 5. PRICES TABLE (Commodity Benchmark Price Oracles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_type TEXT,
    indicative_rate_etb NUMERIC DEFAULT 5000,
    floor_rate_etb NUMERIC DEFAULT 4500,
    ceiling_rate_etb NUMERIC DEFAULT 6000,
    hub_location TEXT DEFAULT 'Bishoftu Hub',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safely rename legacy columns in prices
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prices' AND column_name='price') THEN
        ALTER TABLE public.prices RENAME COLUMN price TO indicative_rate_etb;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prices' AND column_name='rate') THEN
        ALTER TABLE public.prices RENAME COLUMN rate TO indicative_rate_etb;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='prices' AND column_name='crop') THEN
        ALTER TABLE public.prices RENAME COLUMN crop TO crop_type;
    END IF;
END $$;

-- Ensure all columns exist on prices
ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS crop_type TEXT;
ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS indicative_rate_etb NUMERIC DEFAULT 5000;
ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS floor_rate_etb NUMERIC DEFAULT 4500;
ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS ceiling_rate_etb NUMERIC DEFAULT 6000;
ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS hub_location TEXT DEFAULT 'Bishoftu Hub';
ALTER TABLE public.prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Drop any restrictive NOT NULL constraints on floor_rate_etb and ceiling_rate_etb if present from older migrations
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.prices ALTER COLUMN floor_rate_etb DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER TABLE public.prices ALTER COLUMN ceiling_rate_etb DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER TABLE public.prices ALTER COLUMN hub_location DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        ALTER TABLE public.prices ALTER COLUMN indicative_rate_etb DROP NOT NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END $$;

-- Ensure unique constraint on crop_type so ON CONFLICT works reliably
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'prices_crop_type_key'
    ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'prices' AND indexdef LIKE '%UNIQUE%(crop_type)%'
    ) THEN
        BEGIN
            ALTER TABLE public.prices ADD CONSTRAINT prices_crop_type_key UNIQUE (crop_type);
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END IF;
END $$;

-- Insert or update default market price benchmarks with explicit floor & ceiling rates
INSERT INTO public.prices (crop_type, indicative_rate_etb, floor_rate_etb, ceiling_rate_etb, hub_location)
VALUES 
    ('White Teff', 11500, 10800, 12500, 'Bishoftu Hub'),
    ('Bread Wheat', 5200, 4900, 5600, 'Asella Hub'),
    ('Yellow Maize', 3750, 3500, 4100, 'Hawassa Hub'),
    ('Humera Sesame', 16800, 15500, 18200, 'Gondar Hub'),
    ('Specialty Arabica Coffee', 24000, 22000, 26000, 'Jimma Hub'),
    ('Red Kidney Beans', 6800, 6200, 7500, 'Adama Hub')
ON CONFLICT (crop_type) DO UPDATE 
SET indicative_rate_etb = EXCLUDED.indicative_rate_etb,
    floor_rate_etb = COALESCE(EXCLUDED.floor_rate_etb, public.prices.floor_rate_etb, 4500),
    ceiling_rate_etb = COALESCE(EXCLUDED.ceiling_rate_etb, public.prices.ceiling_rate_etb, 6000),
    hub_location = COALESCE(EXCLUDED.hub_location, public.prices.hub_location, 'Bishoftu Hub'),
    updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 6. ROLE PROFILE TABLES (Agents, Buyers, Transporters)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT,
    phone_number TEXT,
    cooperative TEXT,
    region TEXT,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS cooperative TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.buyers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT,
    company_name TEXT,
    email TEXT,
    phone_number TEXT,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.transporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT,
    company_name TEXT,
    phone_number TEXT,
    verified BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT TRUE;
ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- ----------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) & PUBLIC API ACCESS
-- ----------------------------------------------------------------------------
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Public access farmers" ON public.farmers;
    CREATE POLICY "Public access farmers" ON public.farmers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access produce_lots" ON public.produce_lots;
    CREATE POLICY "Public access produce_lots" ON public.produce_lots FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access demands" ON public.demands;
    CREATE POLICY "Public access demands" ON public.demands FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access vehicles" ON public.vehicles;
    CREATE POLICY "Public access vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access prices" ON public.prices;
    CREATE POLICY "Public access prices" ON public.prices FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access agents" ON public.agents;
    CREATE POLICY "Public access agents" ON public.agents FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access buyers" ON public.buyers;
    CREATE POLICY "Public access buyers" ON public.buyers FOR ALL USING (true) WITH CHECK (true);

    DROP POLICY IF EXISTS "Public access transporters" ON public.transporters;
    CREATE POLICY "Public access transporters" ON public.transporters FOR ALL USING (true) WITH CHECK (true);
END $$;

-- Grant schema privileges to standard roles
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
