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

-- Keep this schema compatible with the Flask application and the upgrade script.
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS license_ref TEXT;
ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS license_ref TEXT;
ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.transporters ADD COLUMN IF NOT EXISTS license_ref TEXT;
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS initial_quantity NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS order_ref TEXT;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created ON public.orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_transporter_created ON public.shipments(transporter_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON public.shipments(status);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Staff credentials are stored in Postgres and never created in Supabase Auth.
CREATE TABLE IF NOT EXISTS public.staff_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'transporter')),
    password_hash TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_accounts FROM anon, authenticated;
GRANT ALL ON public.staff_accounts TO service_role;

-- Reserve matching stock and create its order and shipment in one transaction.
CREATE OR REPLACE FUNCTION public.purchase_marketplace_stock(
    p_buyer_id UUID,
    p_buyer_name TEXT,
    p_crop_name TEXT,
    p_quality_grade TEXT,
    p_origin_hub TEXT,
    p_destination_hub TEXT,
    p_quantity NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    lot RECORD;
    available NUMERIC := 0;
    weighted_value NUMERIC := 0;
    needed NUMERIC;
    deduction NUMERIC;
    order_row public.orders%ROWTYPE;
    shipment_row public.shipments%ROWTYPE;
    order_ref_value TEXT := 'ORD-' || replace(gen_random_uuid()::TEXT, '-', '');
BEGIN
    IF p_buyer_id IS NULL OR NULLIF(BTRIM(p_buyer_name), '') IS NULL
       OR NULLIF(BTRIM(p_crop_name), '') IS NULL
       OR NULLIF(BTRIM(p_quality_grade), '') IS NULL
       OR NULLIF(BTRIM(p_origin_hub), '') IS NULL
       OR NULLIF(BTRIM(p_destination_hub), '') IS NULL
       OR p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Invalid purchase details.' USING ERRCODE = '22023';
    END IF;

    -- Lock eligible lots in FIFO order before checking and changing stock.
    FOR lot IN
        SELECT id, quantity, price_per_qtl
        FROM public.produce_lots
        WHERE LOWER(crop_type) = LOWER(BTRIM(p_crop_name))
          AND quality_grade = BTRIM(p_quality_grade)
          AND hub_location = BTRIM(p_origin_hub)
          AND status = 'In Hub Silo'
          AND quantity > 0
          AND price_per_qtl > 0
        ORDER BY harvest_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
        FOR UPDATE
    LOOP
        available := available + lot.quantity;
        weighted_value := weighted_value + (lot.quantity * lot.price_per_qtl);
    END LOOP;

    IF available < p_quantity THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
    END IF;

    needed := p_quantity;
    FOR lot IN
        SELECT id, quantity
        FROM public.produce_lots
        WHERE LOWER(crop_type) = LOWER(BTRIM(p_crop_name))
          AND quality_grade = BTRIM(p_quality_grade)
          AND hub_location = BTRIM(p_origin_hub)
          AND status = 'In Hub Silo'
          AND quantity > 0
          AND price_per_qtl > 0
        ORDER BY harvest_date ASC NULLS LAST, created_at ASC NULLS LAST, id ASC
        FOR UPDATE
    LOOP
        EXIT WHEN needed <= 0;
        deduction := LEAST(lot.quantity, needed);
        UPDATE public.produce_lots
        SET quantity = lot.quantity - deduction,
            status = CASE WHEN lot.quantity - deduction <= 0 THEN 'Fully Dispatched' ELSE status END
        WHERE id = lot.id;
        needed := needed - deduction;
    END LOOP;

    INSERT INTO public.orders (
        order_ref, buyer_id, buyer_name, crop_type, quality_grade,
        quantity, unit_price, total_price, hub_location, status
    ) VALUES (
        order_ref_value, p_buyer_id, BTRIM(p_buyer_name), BTRIM(p_crop_name), BTRIM(p_quality_grade),
        p_quantity, ROUND(weighted_value / available, 2),
        ROUND(p_quantity * weighted_value / available, 2), BTRIM(p_destination_hub), 'Confirmed'
    ) RETURNING * INTO order_row;

    INSERT INTO public.shipments (
        waybill_id, order_id, order_ref, crop_type, quantity,
        origin_hub, destination_hub, tariff_etb, status, stage_index
    ) VALUES (
        'WB-' || replace(gen_random_uuid()::TEXT, '-', ''), order_row.id, order_ref_value,
        BTRIM(p_crop_name), p_quantity, BTRIM(p_origin_hub), BTRIM(p_destination_hub),
        NULL, 'Ready for Carrier', 0
    ) RETURNING * INTO shipment_row;

    RETURN jsonb_build_object(
        'remaining_stock', ROUND(available - p_quantity, 2),
        'order', to_jsonb(order_row),
        'shipment', to_jsonb(shipment_row)
    );
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_marketplace_stock(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_marketplace_stock(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO service_role;
-- Hub transfer offer tables and transactional functions.
ALTER TABLE public.produce_lots ADD COLUMN IF NOT EXISTS target_hub TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS shipment_type TEXT NOT NULL DEFAULT 'buyer_order';
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS quality_grade TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS issue_reported_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS public.shipment_lot_allocations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
 produce_lot_id UUID NOT NULL REFERENCES public.produce_lots(id), agent_id UUID NOT NULL REFERENCES public.staff_accounts(id),
 farmer_kebele_id TEXT, crop_type TEXT NOT NULL, quality_grade TEXT, harvest_date DATE, price_per_qtl NUMERIC NOT NULL DEFAULT 0,
 quantity NUMERIC NOT NULL CHECK(quantity>0), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transfer_allocations_shipment ON public.shipment_lot_allocations(shipment_id);
CREATE TABLE IF NOT EXISTS public.shipment_agent_approvals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
 agent_id UUID NOT NULL REFERENCES public.staff_accounts(id), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reason TEXT, requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), responded_at TIMESTAMPTZ, UNIQUE(shipment_id,agent_id)
);
CREATE INDEX IF NOT EXISTS idx_transfer_approvals_agent_status ON public.shipment_agent_approvals(agent_id,status);
ALTER TABLE public.shipment_lot_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipment_agent_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipment_lot_allocations,public.shipment_agent_approvals FROM anon,authenticated;
GRANT ALL ON public.shipment_lot_allocations,public.shipment_agent_approvals TO service_role;

CREATE OR REPLACE FUNCTION public.generate_hub_transfer_offers(p_threshold_qtl NUMERIC,p_rate_per_qtl NUMERIC)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g RECORD; l RECORD; s public.shipments%ROWTYPE; rem NUMERIC; take_n NUMERIC; n INTEGER:=0; threshold NUMERIC:=COALESCE(p_threshold_qtl,100);
BEGIN
 IF threshold<>100 OR p_rate_per_qtl IS NULL OR p_rate_per_qtl<=0 THEN RAISE EXCEPTION '100 Qtl threshold and positive configured tariff are required.'; END IF;
 PERFORM pg_advisory_xact_lock(173410,100);
 FOR g IN SELECT p.hub_location origin_hub,p.target_hub,p.crop_type,p.quality_grade,SUM(p.quantity) total
 FROM public.produce_lots p JOIN public.staff_accounts a ON a.id=p.agent_id AND a.role='agent' AND a.active
 WHERE p.status='In Hub Silo' AND p.quantity>0 AND p.target_hub IS NOT NULL AND p.target_hub<>p.hub_location
 GROUP BY p.hub_location,p.target_hub,p.crop_type,p.quality_grade HAVING SUM(p.quantity)>=threshold LOOP
  WHILE g.total>=threshold LOOP
   INSERT INTO public.shipments(waybill_id,crop_type,quality_grade,quantity,origin_hub,destination_hub,tariff_etb,status,stage_index,shipment_type)
   VALUES('WB-'||replace(gen_random_uuid()::TEXT,'-',''),g.crop_type,g.quality_grade,threshold,g.origin_hub,g.target_hub,ROUND(threshold*p_rate_per_qtl,2),'Ready for Carrier',0,'hub_transfer') RETURNING * INTO s;
   rem:=threshold;
   FOR l IN SELECT p.* FROM public.produce_lots p JOIN public.staff_accounts a ON a.id=p.agent_id AND a.role='agent' AND a.active
   WHERE p.status='In Hub Silo' AND p.quantity>0 AND p.hub_location=g.origin_hub AND p.target_hub=g.target_hub AND p.crop_type=g.crop_type AND COALESCE(p.quality_grade,'')=COALESCE(g.quality_grade,'')
   ORDER BY p.created_at,p.id FOR UPDATE OF p LOOP
    EXIT WHEN rem<=0; take_n:=LEAST(l.quantity,rem);
    INSERT INTO public.shipment_lot_allocations(shipment_id,produce_lot_id,agent_id,farmer_kebele_id,crop_type,quality_grade,harvest_date,price_per_qtl,quantity)
    VALUES(s.id,l.id,l.agent_id,l.farmer_kebele_id,l.crop_type,l.quality_grade,l.harvest_date,l.price_per_qtl,take_n);
    UPDATE public.produce_lots SET quantity=quantity-take_n,status=CASE WHEN quantity-take_n<=0 THEN 'Fully Dispatched' ELSE status END WHERE id=l.id;
    rem:=rem-take_n;
   END LOOP;
   IF rem>0 THEN RAISE EXCEPTION 'Unable to reserve transfer stock.'; END IF;
   n:=n+1; g.total:=g.total-threshold;
  END LOOP;
 END LOOP; RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.request_hub_transfer_approvals(p_waybill_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.shipments%ROWTYPE; n INTEGER;
BEGIN
 SELECT * INTO s FROM public.shipments WHERE waybill_id=p_waybill_id AND shipment_type IN ('hub_transfer','hub_supply') FOR UPDATE;
 IF NOT FOUND OR s.stage_index<>4 THEN RAISE EXCEPTION 'Delivered hub transfer not found.'; END IF;
 INSERT INTO public.shipment_agent_approvals(shipment_id,agent_id)
 SELECT DISTINCT s.id,a.agent_id FROM public.shipment_lot_allocations a WHERE a.shipment_id=s.id ON CONFLICT(shipment_id,agent_id) DO NOTHING;
 SELECT COUNT(*) INTO n FROM public.shipment_agent_approvals WHERE shipment_id=s.id;
 IF n=0 THEN RAISE EXCEPTION 'No contributing agents found.'; END IF;
 UPDATE public.shipments SET status='Awaiting Agent Approval' WHERE id=s.id;
 UPDATE public.hub_supply_request_shipments SET status='awaiting_approval' WHERE shipment_id=s.id;
 UPDATE public.hub_supply_requests SET status='awaiting_approval' WHERE id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
 RETURN jsonb_build_object('status','Awaiting Agent Approval','approval_count',n);
END; $$;

CREATE OR REPLACE FUNCTION public.respond_to_hub_transfer_approval(p_approval_id UUID,p_agent_id UUID,p_approved BOOLEAN,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.shipment_agent_approvals%ROWTYPE; s public.shipments%ROWTYPE; pending_n INTEGER; rejected_n INTEGER; x RECORD;
BEGIN
 SELECT * INTO a FROM public.shipment_agent_approvals WHERE id=p_approval_id AND agent_id=p_agent_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approval not found for this agent.'; END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Already reviewed.'; END IF;
 IF NOT p_approved AND NULLIF(BTRIM(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason is required.'; END IF;
 UPDATE public.shipment_agent_approvals SET status=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,reason=CASE WHEN p_approved THEN NULL ELSE BTRIM(p_reason) END,responded_at=NOW() WHERE id=p_approval_id;
 SELECT * INTO s FROM public.shipments WHERE id=a.shipment_id FOR UPDATE;
 IF NOT p_approved THEN
  UPDATE public.shipments SET status='Delivery Issue - Admin Review',issue_reported_at=NOW() WHERE id=s.id;
  UPDATE public.hub_supply_request_shipments SET status='delivery_issue' WHERE shipment_id=s.id;
  UPDATE public.hub_supply_requests SET status='delivery_issue' WHERE id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
  RETURN jsonb_build_object('status','Delivery Issue - Admin Review');
 END IF;
 SELECT COUNT(*) INTO pending_n FROM public.shipment_agent_approvals WHERE shipment_id=s.id AND status='pending';
 SELECT COUNT(*) INTO rejected_n FROM public.shipment_agent_approvals WHERE shipment_id=s.id AND status='rejected';
 IF pending_n>0 OR rejected_n>0 THEN RETURN jsonb_build_object('status',CASE WHEN rejected_n>0 THEN 'Delivery Issue - Admin Review' ELSE 'Awaiting Agent Approval' END); END IF;
 IF s.status<>'Agent Approved - Complete' THEN
  FOR x IN SELECT * FROM public.shipment_lot_allocations WHERE shipment_id=s.id ORDER BY id LOOP
   INSERT INTO public.produce_lots(agent_id,farmer_kebele_id,crop_type,quality_grade,quantity,initial_quantity,hub_location,target_hub,harvest_date,price_per_qtl,status,lot_ref)
   VALUES(COALESCE(x.recipient_agent_id,x.agent_id),x.farmer_kebele_id,x.crop_type,x.quality_grade,x.quantity,x.quantity,s.destination_hub,NULL,x.harvest_date,x.price_per_qtl,'In Hub Silo','LOT-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,10)));
  END LOOP;
  UPDATE public.shipments SET status='Agent Approved - Complete' WHERE id=s.id;
  UPDATE public.hub_supply_request_shipments SET status='completed' WHERE shipment_id=s.id;
  UPDATE public.hub_supply_requests r SET status=CASE WHEN NOT EXISTS (SELECT 1 FROM public.hub_supply_request_shipments rs WHERE rs.request_id=r.id AND rs.status NOT IN ('completed','cancelled')) THEN 'completed' ELSE 'assigned' END WHERE r.id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
  UPDATE public.vehicles SET status='Available at Depot' WHERE transporter_id=s.transporter_id AND plate_number=s.vehicle_plate;
 END IF;
 RETURN jsonb_build_object('status','Agent Approved - Complete');
END; $$;
REVOKE ALL ON FUNCTION public.generate_hub_transfer_offers(NUMERIC,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.request_hub_transfer_approvals(TEXT) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.respond_to_hub_transfer_approval(UUID,UUID,BOOLEAN,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.generate_hub_transfer_offers(NUMERIC,NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_hub_transfer_approvals(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.respond_to_hub_transfer_approval(UUID,UUID,BOOLEAN,TEXT) TO service_role;


-- Hub scoped agent approval and auditable admin resolution.
ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS hub_location TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS transfer_attempt INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS resolution_action TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES public.staff_accounts(id);
ALTER TABLE public.shipments ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE public.shipment_agent_approvals ADD COLUMN IF NOT EXISTS attempt_no INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.shipment_agent_approvals DROP CONSTRAINT IF EXISTS shipment_agent_approvals_status_check;
ALTER TABLE public.shipment_agent_approvals ADD CONSTRAINT shipment_agent_approvals_status_check CHECK(status IN ('pending','approved','rejected','superseded'));
ALTER TABLE public.shipment_agent_approvals DROP CONSTRAINT IF EXISTS shipment_agent_approvals_shipment_id_agent_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transfer_approval_attempt_unique ON public.shipment_agent_approvals(shipment_id,agent_id,attempt_no);
UPDATE public.shipment_agent_approvals a SET status='superseded'
WHERE a.status='pending' AND NOT EXISTS (
 SELECT 1 FROM public.shipments s JOIN public.staff_accounts staff ON staff.id=a.agent_id
 WHERE s.id=a.shipment_id AND staff.role='agent' AND staff.active AND staff.hub_location=s.destination_hub
);
CREATE TABLE IF NOT EXISTS public.shipment_transfer_resolutions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
 admin_id UUID NOT NULL REFERENCES public.staff_accounts(id),
 action TEXT NOT NULL CHECK(action IN ('complete','retry','cancel')),
 note TEXT NOT NULL,
 attempt_no INTEGER NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.shipment_transfer_resolutions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipment_transfer_resolutions FROM anon,authenticated;
GRANT ALL ON public.shipment_transfer_resolutions TO service_role;

CREATE OR REPLACE FUNCTION public.generate_hub_transfer_offers(p_threshold_qtl NUMERIC,p_rate_per_qtl NUMERIC)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE g RECORD; l RECORD; s public.shipments%ROWTYPE; rem NUMERIC; take_n NUMERIC; n INTEGER:=0; threshold NUMERIC:=COALESCE(p_threshold_qtl,100);
BEGIN
 IF threshold<>100 OR p_rate_per_qtl IS NULL OR p_rate_per_qtl<=0 THEN RAISE EXCEPTION '100 Qtl threshold and positive configured tariff are required.'; END IF;
 PERFORM pg_advisory_xact_lock(173410,100);
 FOR g IN SELECT p.hub_location origin_hub,p.target_hub,p.crop_type,p.quality_grade,SUM(p.quantity) total
 FROM public.produce_lots p JOIN public.staff_accounts a ON a.id=p.agent_id AND a.role='agent' AND a.active
 WHERE p.status='In Hub Silo' AND p.quantity>0 AND p.target_hub IS NOT NULL AND p.target_hub<>p.hub_location
 AND EXISTS (SELECT 1 FROM public.staff_accounts destination_agent WHERE destination_agent.role='agent' AND destination_agent.active AND destination_agent.hub_location=p.target_hub)
 GROUP BY p.hub_location,p.target_hub,p.crop_type,p.quality_grade HAVING SUM(p.quantity)>=threshold LOOP
  WHILE g.total>=threshold LOOP
   INSERT INTO public.shipments(waybill_id,crop_type,quality_grade,quantity,origin_hub,destination_hub,tariff_etb,status,stage_index,shipment_type,transfer_attempt)
   VALUES('WB-'||replace(gen_random_uuid()::TEXT,'-',''),g.crop_type,g.quality_grade,threshold,g.origin_hub,g.target_hub,ROUND(threshold*p_rate_per_qtl,2),'Ready for Carrier',0,'hub_transfer',1) RETURNING * INTO s;
   rem:=threshold;
   FOR l IN SELECT p.* FROM public.produce_lots p JOIN public.staff_accounts a ON a.id=p.agent_id AND a.role='agent' AND a.active
   WHERE p.status='In Hub Silo' AND p.quantity>0 AND p.hub_location=g.origin_hub AND p.target_hub=g.target_hub AND p.crop_type=g.crop_type AND COALESCE(p.quality_grade,'')=COALESCE(g.quality_grade,'')
   ORDER BY p.created_at,p.id FOR UPDATE OF p LOOP
    EXIT WHEN rem<=0; take_n:=LEAST(l.quantity,rem);
    INSERT INTO public.shipment_lot_allocations(shipment_id,produce_lot_id,agent_id,farmer_kebele_id,crop_type,quality_grade,harvest_date,price_per_qtl,quantity)
    VALUES(s.id,l.id,l.agent_id,l.farmer_kebele_id,l.crop_type,l.quality_grade,l.harvest_date,l.price_per_qtl,take_n);
    UPDATE public.produce_lots SET quantity=quantity-take_n,status=CASE WHEN quantity-take_n<=0 THEN 'Fully Dispatched' ELSE status END WHERE id=l.id;
    rem:=rem-take_n;
   END LOOP;
   IF rem>0 THEN RAISE EXCEPTION 'Unable to reserve transfer stock.'; END IF;
   n:=n+1; g.total:=g.total-threshold;
  END LOOP;
 END LOOP; RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.request_hub_transfer_approvals(p_waybill_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.shipments%ROWTYPE; n INTEGER;
BEGIN
 SELECT * INTO s FROM public.shipments WHERE waybill_id=p_waybill_id AND shipment_type IN ('hub_transfer','hub_supply') FOR UPDATE;
 IF NOT FOUND OR s.stage_index<>4 THEN RAISE EXCEPTION 'Delivered hub transfer not found.'; END IF;
 UPDATE public.shipment_agent_approvals a SET status='superseded'
 WHERE a.shipment_id=s.id AND a.attempt_no=s.transfer_attempt AND a.status='pending'
 AND NOT EXISTS (SELECT 1 FROM public.staff_accounts staff WHERE staff.id=a.agent_id AND staff.role='agent' AND staff.active AND staff.hub_location=s.destination_hub);
 INSERT INTO public.shipment_agent_approvals(shipment_id,agent_id,attempt_no)
 SELECT s.id,a.id,s.transfer_attempt FROM public.staff_accounts a
 WHERE a.role='agent' AND a.active AND a.hub_location=s.destination_hub
 ON CONFLICT(shipment_id,agent_id,attempt_no) DO NOTHING;
 SELECT COUNT(*) INTO n FROM public.shipment_agent_approvals WHERE shipment_id=s.id AND attempt_no=s.transfer_attempt;
 IF n=0 THEN RAISE EXCEPTION 'No active agent is assigned to the destination hub. Contact an administrator.'; END IF;
 UPDATE public.shipments SET status='Awaiting Agent Approval' WHERE id=s.id;
 UPDATE public.hub_supply_request_shipments SET status='awaiting_approval' WHERE shipment_id=s.id;
 UPDATE public.hub_supply_requests SET status='awaiting_approval' WHERE id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
 RETURN jsonb_build_object('status','Awaiting Agent Approval','approval_count',n,'destination_hub',s.destination_hub);
END; $$;

CREATE OR REPLACE FUNCTION public.respond_to_hub_transfer_approval(p_approval_id UUID,p_agent_id UUID,p_approved BOOLEAN,p_reason TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.shipment_agent_approvals%ROWTYPE; s public.shipments%ROWTYPE; pending_n INTEGER; rejected_n INTEGER; x RECORD;
BEGIN
 SELECT * INTO a FROM public.shipment_agent_approvals WHERE id=p_approval_id AND agent_id=p_agent_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Approval not found for this agent.'; END IF;
 SELECT * INTO s FROM public.shipments WHERE id=a.shipment_id FOR UPDATE;
 IF a.attempt_no<>s.transfer_attempt THEN RAISE EXCEPTION 'This approval belongs to an earlier delivery attempt.'; END IF;
 IF a.status<>'pending' THEN RAISE EXCEPTION 'Already reviewed.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff_accounts WHERE id=p_agent_id AND role='agent' AND active AND hub_location=s.destination_hub) THEN
   RAISE EXCEPTION 'Only an active agent assigned to the destination hub can review this delivery.';
 END IF;
 IF NOT p_approved AND NULLIF(BTRIM(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Rejection reason is required.'; END IF;
 UPDATE public.shipment_agent_approvals SET status=CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,reason=CASE WHEN p_approved THEN NULL ELSE BTRIM(p_reason) END,responded_at=NOW() WHERE id=p_approval_id;
 IF NOT p_approved THEN
  UPDATE public.shipments SET status='Delivery Issue - Admin Review',issue_reported_at=NOW() WHERE id=s.id;
  UPDATE public.hub_supply_request_shipments SET status='delivery_issue' WHERE shipment_id=s.id;
  UPDATE public.hub_supply_requests SET status='delivery_issue' WHERE id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
  RETURN jsonb_build_object('status','Delivery Issue - Admin Review');
 END IF;
 SELECT COUNT(*) INTO pending_n FROM public.shipment_agent_approvals WHERE shipment_id=s.id AND attempt_no=s.transfer_attempt AND status='pending';
 SELECT COUNT(*) INTO rejected_n FROM public.shipment_agent_approvals WHERE shipment_id=s.id AND attempt_no=s.transfer_attempt AND status='rejected';
 IF pending_n>0 OR rejected_n>0 THEN RETURN jsonb_build_object('status',CASE WHEN rejected_n>0 THEN 'Delivery Issue - Admin Review' ELSE 'Awaiting Agent Approval' END); END IF;
 IF s.status NOT IN ('Agent Approved - Complete','Admin Resolved - Complete') THEN
  FOR x IN SELECT * FROM public.shipment_lot_allocations WHERE shipment_id=s.id ORDER BY id LOOP
   INSERT INTO public.produce_lots(agent_id,farmer_kebele_id,crop_type,quality_grade,quantity,initial_quantity,hub_location,target_hub,harvest_date,price_per_qtl,status,lot_ref)
   VALUES(COALESCE(x.recipient_agent_id,x.agent_id),x.farmer_kebele_id,x.crop_type,x.quality_grade,x.quantity,x.quantity,s.destination_hub,NULL,x.harvest_date,x.price_per_qtl,'In Hub Silo','LOT-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,10)));
  END LOOP;
  UPDATE public.shipments SET status='Agent Approved - Complete' WHERE id=s.id;
  UPDATE public.hub_supply_request_shipments SET status='completed' WHERE shipment_id=s.id;
  UPDATE public.hub_supply_requests r SET status=CASE WHEN NOT EXISTS (SELECT 1 FROM public.hub_supply_request_shipments rs WHERE rs.request_id=r.id AND rs.status NOT IN ('completed','cancelled')) THEN 'completed' ELSE 'assigned' END WHERE r.id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
  UPDATE public.vehicles SET status='Available at Depot' WHERE transporter_id=s.transporter_id AND plate_number=s.vehicle_plate;
 END IF;
 RETURN jsonb_build_object('status','Agent Approved - Complete');
END; $$;

CREATE OR REPLACE FUNCTION public.resolve_hub_transfer_issue(p_waybill_id TEXT,p_action TEXT,p_admin_id UUID,p_note TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s public.shipments%ROWTYPE; x RECORD;
BEGIN
 IF p_action NOT IN ('complete','retry','cancel') OR NULLIF(BTRIM(p_note),'') IS NULL THEN RAISE EXCEPTION 'Valid resolution action and note are required.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.staff_accounts WHERE id=p_admin_id AND role='admin' AND active) THEN RAISE EXCEPTION 'Active administrator account required.'; END IF;
 SELECT * INTO s FROM public.shipments WHERE waybill_id=p_waybill_id AND shipment_type IN ('hub_transfer','hub_supply') FOR UPDATE;
 IF NOT FOUND OR s.status<>'Delivery Issue - Admin Review' THEN RAISE EXCEPTION 'Unresolved delivery issue not found.'; END IF;
 INSERT INTO public.shipment_transfer_resolutions(shipment_id,admin_id,action,note,attempt_no) VALUES(s.id,p_admin_id,p_action,BTRIM(p_note),s.transfer_attempt);
 IF p_action='complete' THEN
  UPDATE public.shipment_agent_approvals SET status='superseded' WHERE shipment_id=s.id AND attempt_no=s.transfer_attempt AND status='pending';
  FOR x IN SELECT * FROM public.shipment_lot_allocations WHERE shipment_id=s.id ORDER BY id LOOP
   INSERT INTO public.produce_lots(agent_id,farmer_kebele_id,crop_type,quality_grade,quantity,initial_quantity,hub_location,target_hub,harvest_date,price_per_qtl,status,lot_ref)
   VALUES(COALESCE(x.recipient_agent_id,x.agent_id),x.farmer_kebele_id,x.crop_type,x.quality_grade,x.quantity,x.quantity,s.destination_hub,NULL,x.harvest_date,x.price_per_qtl,'In Hub Silo','LOT-'||upper(substr(replace(gen_random_uuid()::TEXT,'-',''),1,10)));
  END LOOP;
  UPDATE public.hub_supply_request_shipments SET status='completed' WHERE shipment_id=s.id;
  UPDATE public.hub_supply_requests r SET status=CASE WHEN NOT EXISTS (SELECT 1 FROM public.hub_supply_request_shipments rs WHERE rs.request_id=r.id AND rs.status NOT IN ('completed','cancelled')) THEN 'completed' ELSE 'assigned' END WHERE r.id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
  UPDATE public.shipments SET status='Admin Resolved - Complete',resolution_action=p_action,resolution_note=BTRIM(p_note),resolved_by=p_admin_id,resolved_at=NOW() WHERE id=s.id;
  UPDATE public.vehicles SET status='Available at Depot' WHERE transporter_id=s.transporter_id AND plate_number=s.vehicle_plate;
 ELSIF p_action='retry' THEN
  UPDATE public.shipment_agent_approvals SET status='superseded' WHERE shipment_id=s.id AND attempt_no=s.transfer_attempt AND status='pending';
  UPDATE public.shipments SET status='In Transit',stage_index=3,transfer_attempt=transfer_attempt+1,delivered_at=NULL,
    resolution_action=p_action,resolution_note=BTRIM(p_note),resolved_by=p_admin_id,resolved_at=NOW() WHERE id=s.id;
 ELSE
  UPDATE public.shipment_agent_approvals SET status='superseded' WHERE shipment_id=s.id AND attempt_no=s.transfer_attempt AND status='pending';
  FOR x IN SELECT * FROM public.shipment_lot_allocations WHERE shipment_id=s.id LOOP
   UPDATE public.produce_lots SET quantity=quantity+x.quantity,status='In Hub Silo' WHERE id=x.produce_lot_id;
  END LOOP;
  UPDATE public.hub_supply_request_shipments SET status='cancelled' WHERE shipment_id=s.id;
  UPDATE public.hub_supply_requests r SET status=CASE WHEN NOT EXISTS (SELECT 1 FROM public.hub_supply_request_shipments rs WHERE rs.request_id=r.id AND rs.status NOT IN ('completed','cancelled')) THEN 'cancelled' ELSE 'assigned' END WHERE r.id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=s.id);
  UPDATE public.shipments SET status='Cancelled by Admin',resolution_action=p_action,resolution_note=BTRIM(p_note),resolved_by=p_admin_id,resolved_at=NOW() WHERE id=s.id;
  UPDATE public.vehicles SET status='Available at Depot' WHERE transporter_id=s.transporter_id AND plate_number=s.vehicle_plate;
 END IF;
 RETURN jsonb_build_object('status',CASE WHEN p_action='complete' THEN 'Admin Resolved - Complete' WHEN p_action='retry' THEN 'In Transit' ELSE 'Cancelled by Admin' END,'action',p_action,'transfer_attempt',CASE WHEN p_action='retry' THEN s.transfer_attempt+1 ELSE s.transfer_attempt END);
END; $$;
REVOKE ALL ON FUNCTION public.resolve_hub_transfer_issue(TEXT,TEXT,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_hub_transfer_issue(TEXT,TEXT,UUID,TEXT) TO service_role;

-- One centrally configured buyer price per crop, managed by administrators.
CREATE TABLE IF NOT EXISTS public.crop_prices (
 crop_type TEXT PRIMARY KEY CHECK (NULLIF(BTRIM(crop_type), '') IS NOT NULL),
 fixed_price_per_qtl NUMERIC(12,2) NOT NULL CHECK (fixed_price_per_qtl > 0),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 updated_by UUID REFERENCES public.staff_accounts(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade the earlier table shape, which used crop_name instead of crop_type.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crop_prices' AND column_name='crop_name'
 ) AND NOT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crop_prices' AND column_name='crop_type'
 ) THEN
  ALTER TABLE public.crop_prices RENAME COLUMN crop_name TO crop_type;
 END IF;
END $$;

ALTER TABLE public.crop_prices ADD COLUMN IF NOT EXISTS crop_type TEXT;
ALTER TABLE public.crop_prices ADD COLUMN IF NOT EXISTS fixed_price_per_qtl NUMERIC(12,2);
ALTER TABLE public.crop_prices ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE public.crop_prices ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES public.staff_accounts(id);
ALTER TABLE public.crop_prices ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_prices_crop_type_unique ON public.crop_prices(crop_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_prices_casefold_unique ON public.crop_prices(LOWER(crop_type));
ALTER TABLE public.crop_prices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.crop_prices FROM anon,authenticated;
GRANT ALL ON public.crop_prices TO service_role;

-- The database, not the submitted form or old per-lot values, sets the purchase rate.
CREATE OR REPLACE FUNCTION public.purchase_marketplace_stock(
 p_buyer_id UUID,p_buyer_name TEXT,p_crop_name TEXT,p_quality_grade TEXT,
 p_origin_hub TEXT,p_destination_hub TEXT,p_quantity NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql SET search_path=public AS $$
DECLARE
 lot RECORD; available NUMERIC:=0; needed NUMERIC; deduction NUMERIC;
 order_row public.orders%ROWTYPE; shipment_row public.shipments%ROWTYPE;
 unit_price NUMERIC; canonical_crop TEXT;
 order_ref_value TEXT:='ORD-'||replace(gen_random_uuid()::TEXT,'-','');
BEGIN
 IF p_buyer_id IS NULL OR NULLIF(BTRIM(p_buyer_name),'') IS NULL
    OR NULLIF(BTRIM(p_crop_name),'') IS NULL OR NULLIF(BTRIM(p_quality_grade),'') IS NULL
    OR NULLIF(BTRIM(p_origin_hub),'') IS NULL OR NULLIF(BTRIM(p_destination_hub),'') IS NULL
    OR p_quantity IS NULL OR p_quantity<=0 THEN RAISE EXCEPTION 'Invalid purchase details.' USING ERRCODE='22023'; END IF;
 SELECT crop_type,fixed_price_per_qtl INTO canonical_crop,unit_price
 FROM public.crop_prices WHERE LOWER(crop_type)=LOWER(BTRIM(p_crop_name)) AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'No active fixed price is configured for this crop.' USING ERRCODE='22023'; END IF;
 FOR lot IN SELECT id,quantity FROM public.produce_lots
  WHERE LOWER(crop_type)=LOWER(canonical_crop) AND quality_grade=BTRIM(p_quality_grade)
   AND hub_location=BTRIM(p_origin_hub) AND status='In Hub Silo' AND quantity>0
  ORDER BY harvest_date ASC NULLS LAST,created_at ASC NULLS LAST,id ASC FOR UPDATE
 LOOP available:=available+lot.quantity; END LOOP;
 IF available<p_quantity THEN RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE='P0001'; END IF;
 needed:=p_quantity;
 FOR lot IN SELECT id,quantity FROM public.produce_lots
  WHERE LOWER(crop_type)=LOWER(canonical_crop) AND quality_grade=BTRIM(p_quality_grade)
   AND hub_location=BTRIM(p_origin_hub) AND status='In Hub Silo' AND quantity>0
  ORDER BY harvest_date ASC NULLS LAST,created_at ASC NULLS LAST,id ASC FOR UPDATE
 LOOP
  EXIT WHEN needed<=0; deduction:=LEAST(lot.quantity,needed);
  UPDATE public.produce_lots SET quantity=lot.quantity-deduction,
   status=CASE WHEN lot.quantity-deduction<=0 THEN 'Fully Dispatched' ELSE status END WHERE id=lot.id;
  needed:=needed-deduction;
 END LOOP;
 INSERT INTO public.orders(order_ref,buyer_id,buyer_name,crop_type,quality_grade,quantity,unit_price,total_price,hub_location,status)
 VALUES(order_ref_value,p_buyer_id,BTRIM(p_buyer_name),canonical_crop,BTRIM(p_quality_grade),p_quantity,unit_price,ROUND(p_quantity*unit_price,2),BTRIM(p_destination_hub),'Confirmed')
 RETURNING * INTO order_row;
 INSERT INTO public.shipments(waybill_id,order_id,order_ref,crop_type,quality_grade,quantity,origin_hub,destination_hub,tariff_etb,status,stage_index)
 VALUES('WB-'||replace(gen_random_uuid()::TEXT,'-',''),order_row.id,order_ref_value,canonical_crop,BTRIM(p_quality_grade),p_quantity,BTRIM(p_origin_hub),BTRIM(p_destination_hub),NULL,'Ready for Carrier',0)
 RETURNING * INTO shipment_row;
 RETURN jsonb_build_object('remaining_stock',ROUND(available-p_quantity,2),'order',to_jsonb(order_row),'shipment',to_jsonb(shipment_row));
END; $$;
REVOKE ALL ON FUNCTION public.purchase_marketplace_stock(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.purchase_marketplace_stock(UUID,TEXT,TEXT,TEXT,TEXT,TEXT,NUMERIC) TO service_role;

-- Agent-requested hub replenishment and fair automatic carrier assignment.
ALTER TABLE public.shipment_lot_allocations
 ADD COLUMN IF NOT EXISTS recipient_agent_id UUID REFERENCES public.staff_accounts(id);
CREATE TABLE IF NOT EXISTS public.hub_supply_requests (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 requester_agent_id UUID NOT NULL REFERENCES public.staff_accounts(id),
 source_hub TEXT NOT NULL,
 destination_hub TEXT NOT NULL,
 crop_type TEXT NOT NULL,
 quality_grade TEXT NOT NULL,
 quantity NUMERIC NOT NULL CHECK (quantity > 0),
 minimum_source_reserve_qtl NUMERIC NOT NULL DEFAULT 10 CHECK (minimum_source_reserve_qtl >= 0),
 shipment_id UUID UNIQUE REFERENCES public.shipments(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'awaiting_carrier' CHECK (status IN ('awaiting_carrier','assigned','awaiting_approval','delivery_issue','completed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hub_supply_requests_agent_created ON public.hub_supply_requests(requester_agent_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hub_supply_requests_status_created ON public.hub_supply_requests(status,created_at);
ALTER TABLE public.hub_supply_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hub_supply_requests FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.hub_supply_requests TO service_role;

CREATE TABLE IF NOT EXISTS public.hub_supply_request_shipments (
 request_id UUID NOT NULL REFERENCES public.hub_supply_requests(id) ON DELETE CASCADE,
 shipment_id UUID NOT NULL UNIQUE REFERENCES public.shipments(id) ON DELETE CASCADE,
 assigned_quantity NUMERIC NOT NULL CHECK (assigned_quantity > 0),
 status TEXT NOT NULL DEFAULT 'awaiting_carrier' CHECK (status IN ('awaiting_carrier','assigned','awaiting_approval','delivery_issue','completed','cancelled')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY(request_id,shipment_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_supply_request_shipments_request ON public.hub_supply_request_shipments(request_id);
ALTER TABLE public.hub_supply_request_shipments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.hub_supply_request_shipments FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.hub_supply_request_shipments TO service_role;

CREATE OR REPLACE FUNCTION public.create_hub_supply_request(
 p_agent_id UUID, p_crop_type TEXT, p_quality_grade TEXT, p_quantity NUMERIC,
 p_destination_hub TEXT, p_source_hubs TEXT[], p_min_reserve_qtl NUMERIC, p_rate_per_qtl NUMERIC
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 destination_agent public.staff_accounts%ROWTYPE;
 source_hub TEXT;
 canonical_crop TEXT;
 shipment_row public.shipments%ROWTYPE;
 request_row public.hub_supply_requests%ROWTYPE;
 lot RECORD;
 request_remaining NUMERIC;
 trip_remaining NUMERIC;
 take_qtl NUMERIC;
 trip_capacity NUMERIC;
 first_shipment_id UUID;
 shipment_list JSONB:='[]'::JSONB;
BEGIN
 IF p_quantity IS NULL OR p_quantity <= 0 OR NULLIF(BTRIM(p_crop_type),'') IS NULL
    OR NULLIF(BTRIM(p_quality_grade),'') IS NULL OR p_destination_hub IS NULL
    OR COALESCE(array_length(p_source_hubs,1),0)=0 THEN
  RAISE EXCEPTION 'Invalid supply request details.' USING ERRCODE='22023';
 END IF;
 SELECT * INTO destination_agent FROM public.staff_accounts
  WHERE id=p_agent_id AND role='agent' AND active AND hub_location=p_destination_hub FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'NO_ACTIVE_AGENT'; END IF;
 SELECT candidate.hub INTO source_hub
 FROM unnest(p_source_hubs) WITH ORDINALITY AS candidate(hub,ord)
 CROSS JOIN LATERAL (
  SELECT COALESCE(SUM(l.quantity),0) AS available
  FROM public.produce_lots l
  JOIN public.staff_accounts source_agent ON source_agent.id=l.agent_id AND source_agent.role='agent' AND source_agent.active
  WHERE l.hub_location=candidate.hub AND l.status='In Hub Silo' AND l.quantity>0
    AND LOWER(l.crop_type)=LOWER(BTRIM(p_crop_type))
    AND COALESCE(l.quality_grade,'')=BTRIM(p_quality_grade)
 ) stock
 WHERE candidate.hub<>p_destination_hub
   AND stock.available >= p_quantity + GREATEST(COALESCE(p_min_reserve_qtl,0),0)
 ORDER BY candidate.ord LIMIT 1;
 IF source_hub IS NULL THEN RAISE EXCEPTION 'INSUFFICIENT_NEARBY_STOCK'; END IF;
 SELECT crop_type INTO canonical_crop FROM public.produce_lots
  WHERE hub_location=source_hub AND LOWER(crop_type)=LOWER(BTRIM(p_crop_type))
    AND COALESCE(quality_grade,'')=BTRIM(p_quality_grade) AND status='In Hub Silo' AND quantity>0
  ORDER BY created_at,id LIMIT 1;
 -- Use the smallest registered, non-grounded fleet capacity so each split trip
 -- can be handled by any eligible carrier when duties are assigned later.
 SELECT MIN(v.capacity_quintals) INTO trip_capacity FROM public.vehicles v
 JOIN public.staff_accounts t ON t.id=v.transporter_id AND t.role='transporter' AND t.active
 WHERE (v.status IN ('Approved for Hub Dispatch','Pending Roadworthiness Approval') OR v.status LIKE 'On Trip (%') AND COALESCE(v.capacity_quintals,0)>0;
 trip_capacity:=COALESCE(trip_capacity,100);
 INSERT INTO public.hub_supply_requests(requester_agent_id,source_hub,destination_hub,crop_type,quality_grade,quantity,minimum_source_reserve_qtl,status)
 VALUES(p_agent_id,source_hub,p_destination_hub,canonical_crop,BTRIM(p_quality_grade),p_quantity,GREATEST(COALESCE(p_min_reserve_qtl,0),0),'awaiting_carrier')
 RETURNING * INTO request_row;
 request_remaining:=p_quantity;
 WHILE request_remaining>0 LOOP
  trip_remaining:=LEAST(request_remaining,trip_capacity);
  INSERT INTO public.shipments(waybill_id,crop_type,quality_grade,quantity,origin_hub,destination_hub,tariff_etb,status,stage_index,shipment_type,transfer_attempt)
  VALUES('WB-'||replace(gen_random_uuid()::TEXT,'-',''),canonical_crop,BTRIM(p_quality_grade),trip_remaining,source_hub,p_destination_hub,
   CASE WHEN COALESCE(p_rate_per_qtl,0)>0 THEN ROUND(trip_remaining*p_rate_per_qtl,2) ELSE 0 END,
   'Ready for Carrier',0,'hub_supply',1)
  RETURNING * INTO shipment_row;
  IF first_shipment_id IS NULL THEN first_shipment_id:=shipment_row.id; END IF;
  INSERT INTO public.hub_supply_request_shipments(request_id,shipment_id,assigned_quantity,status)
  VALUES(request_row.id,shipment_row.id,trip_remaining,'awaiting_carrier');
  trip_remaining:=shipment_row.quantity;
  FOR lot IN
   SELECT l.* FROM public.produce_lots l
   JOIN public.staff_accounts source_agent ON source_agent.id=l.agent_id AND source_agent.role='agent' AND source_agent.active
   WHERE l.hub_location=source_hub AND LOWER(l.crop_type)=LOWER(canonical_crop)
     AND COALESCE(l.quality_grade,'')=BTRIM(p_quality_grade) AND l.status='In Hub Silo' AND l.quantity>0
   ORDER BY l.harvest_date ASC NULLS LAST,l.created_at ASC NULLS LAST,l.id
   FOR UPDATE OF l
  LOOP
   EXIT WHEN trip_remaining<=0;
   take_qtl:=LEAST(lot.quantity,trip_remaining);
   INSERT INTO public.shipment_lot_allocations(shipment_id,produce_lot_id,agent_id,recipient_agent_id,farmer_kebele_id,crop_type,quality_grade,harvest_date,price_per_qtl,quantity)
   VALUES(shipment_row.id,lot.id,lot.agent_id,p_agent_id,lot.farmer_kebele_id,canonical_crop,BTRIM(p_quality_grade),lot.harvest_date,COALESCE(lot.price_per_qtl,0),take_qtl);
   UPDATE public.produce_lots SET quantity=quantity-take_qtl,
    status=CASE WHEN quantity-take_qtl<=0 THEN 'Fully Dispatched' ELSE status END WHERE id=lot.id;
   trip_remaining:=trip_remaining-take_qtl;
  END LOOP;
  IF trip_remaining>0 THEN RAISE EXCEPTION 'INSUFFICIENT_NEARBY_STOCK'; END IF;
  shipment_list:=shipment_list||jsonb_build_array(to_jsonb(shipment_row));
  request_remaining:=request_remaining-shipment_row.quantity;
 END LOOP;
 UPDATE public.hub_supply_requests SET shipment_id=first_shipment_id WHERE id=request_row.id RETURNING * INTO request_row;
 RETURN jsonb_build_object('request',to_jsonb(request_row),'shipments',shipment_list);
END; $$;
CREATE OR REPLACE FUNCTION public.assign_hub_supply_duties()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 pending public.shipments%ROWTYPE;
 carrier RECORD;
 assigned_count INTEGER:=0;
BEGIN
 -- Serialize all claim/dispatch decisions to prevent concurrent double-booking.
 PERFORM pg_advisory_xact_lock(174110,1);
 FOR pending IN
  SELECT * FROM public.shipments
  WHERE shipment_type='hub_supply' AND status='Ready for Carrier' AND transporter_id IS NULL
  ORDER BY created_at,id FOR UPDATE SKIP LOCKED
 LOOP
  SELECT t.id AS transporter_id,t.full_name,v.id AS vehicle_id,v.plate_number
   INTO carrier
  FROM public.staff_accounts t
  JOIN public.vehicles v ON v.transporter_id=t.id AND v.status='Approved for Hub Dispatch'
    AND COALESCE(v.capacity_quintals,0)>=pending.quantity
  WHERE t.role='transporter' AND t.active
    AND NOT EXISTS (
     SELECT 1 FROM public.shipments active_trip
     WHERE active_trip.transporter_id=t.id
       AND active_trip.status IN ('Dispatched','Loaded & Weighed','In Transit','Awaiting Agent Approval','Delivery Issue - Admin Review')
    )
  ORDER BY
   (SELECT COUNT(*) FROM public.shipments history WHERE history.transporter_id=t.id AND history.claimed_at>=NOW()-INTERVAL '30 days') ASC,
   (SELECT MAX(history.claimed_at) FROM public.shipments history WHERE history.transporter_id=t.id) ASC NULLS FIRST,
   t.id,v.capacity_quintals,v.id
  LIMIT 1 FOR UPDATE OF t,v SKIP LOCKED;
  IF FOUND THEN
   UPDATE public.shipments SET transporter_id=carrier.transporter_id,transporter_name=carrier.full_name,
    vehicle_plate=carrier.plate_number,status='Dispatched',stage_index=1,claimed_at=NOW()
   WHERE id=pending.id AND status='Ready for Carrier' AND transporter_id IS NULL;
   IF FOUND THEN
    UPDATE public.vehicles SET status='On Trip ('||pending.waybill_id||')' WHERE id=carrier.vehicle_id;
    UPDATE public.hub_supply_requests SET status='assigned' WHERE id IN (SELECT request_id FROM public.hub_supply_request_shipments WHERE shipment_id=pending.id);
    UPDATE public.hub_supply_request_shipments SET status='assigned' WHERE shipment_id=pending.id;
    assigned_count:=assigned_count+1;
   END IF;
  END IF;
 END LOOP;
 RETURN assigned_count;
END; $$;

REVOKE ALL ON FUNCTION public.create_hub_supply_request(UUID,TEXT,TEXT,NUMERIC,TEXT,TEXT[],NUMERIC,NUMERIC) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.assign_hub_supply_duties() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_hub_supply_request(UUID,TEXT,TEXT,NUMERIC,TEXT,TEXT[],NUMERIC,NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.assign_hub_supply_duties() TO service_role;

-- Make manual buyer-load claims serialize with automatic hub-duty assignment.
CREATE OR REPLACE FUNCTION public.claim_available_shipment(
 p_transporter_id UUID, p_waybill_id TEXT, p_vehicle_plate TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
 shipment_row public.shipments%ROWTYPE;
 transporter_row public.staff_accounts%ROWTYPE;
 vehicle_row public.vehicles%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(174110,1);
 SELECT * INTO shipment_row FROM public.shipments
  WHERE waybill_id=p_waybill_id AND status='Ready for Carrier' AND transporter_id IS NULL
   AND COALESCE(shipment_type,'buyer_order')<>'hub_supply'
  FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LOAD_UNAVAILABLE'; END IF;
 SELECT * INTO transporter_row FROM public.staff_accounts
  WHERE id=p_transporter_id AND role='transporter' AND active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'TRANSPORTER_NOT_ACTIVE'; END IF;
 IF EXISTS (
  SELECT 1 FROM public.shipments active_trip WHERE active_trip.transporter_id=p_transporter_id
   AND active_trip.status IN ('Dispatched','Loaded & Weighed','In Transit','Awaiting Agent Approval','Delivery Issue - Admin Review')
 ) THEN RAISE EXCEPTION 'ACTIVE_TRIP_EXISTS'; END IF;
 SELECT * INTO vehicle_row FROM public.vehicles
  WHERE transporter_id=p_transporter_id AND plate_number=BTRIM(p_vehicle_plate)
   AND status='Approved for Hub Dispatch' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_APPROVED'; END IF;
 IF COALESCE(vehicle_row.capacity_quintals,0)<shipment_row.quantity THEN
  RAISE EXCEPTION 'VEHICLE_CAPACITY_TOO_SMALL';
 END IF;
 UPDATE public.shipments SET transporter_id=p_transporter_id,transporter_name=transporter_row.full_name,
  vehicle_plate=vehicle_row.plate_number,status='Dispatched',stage_index=1,claimed_at=NOW()
 WHERE id=shipment_row.id RETURNING * INTO shipment_row;
 UPDATE public.vehicles SET status='On Trip ('||shipment_row.waybill_id||')' WHERE id=vehicle_row.id;
 IF shipment_row.order_id IS NOT NULL THEN
  UPDATE public.orders SET status='Dispatched' WHERE id=shipment_row.order_id;
 END IF;
 RETURN to_jsonb(shipment_row);
END; $$;
REVOKE ALL ON FUNCTION public.claim_available_shipment(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_available_shipment(UUID,TEXT,TEXT) TO service_role;
