-- ==============================================================================
-- DOMPETKU - SUPABASE DATABASE SCHEMA & RLS POLICIES
-- Jalankan skrip ini di SQL Editor dashboard Supabase project Anda.
-- ==============================================================================

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. PROFILES TABLE (Sinkron dengan auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. POCKETS (KANTONG / REKENING)
CREATE TABLE IF NOT EXISTS public.pockets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    initial_balance NUMERIC(15,2) DEFAULT 0 NOT NULL,
    target_balance NUMERIC(15,2) DEFAULT NULL,
    icon TEXT DEFAULT 'fa-wallet' NOT NULL,
    color TEXT DEFAULT '#5b55f9' NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CATEGORIES (KATEGORI TRANSAKSI)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    icon TEXT DEFAULT 'fa-tag' NOT NULL,
    color TEXT DEFAULT '#5b55f9' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, name, type)
);

-- 5. TRANSACTIONS (TRANSAKSI TAHUN AKTIF)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pocket_id UUID NOT NULL REFERENCES public.pockets(id) ON DELETE CASCADE,
    destination_pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
    category_name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'transfer')),
    amount NUMERIC(15,2) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    reference_id UUID DEFAULT NULL,
    reference_type TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TRANSACTION_ARCHIVES (ARSIP TRANSAKSI TAHUN LALU)
CREATE TABLE IF NOT EXISTS public.transaction_archives (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    pocket_id UUID,
    destination_pocket_id UUID,
    category_name TEXT NOT NULL,
    type TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    reference_id UUID,
    reference_type TEXT,
    created_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ DEFAULT now()
);

-- 7. BUDGETS (ANGGARAN BULANAN)
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    amount_limit NUMERIC(15,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category_name, month, year)
);

-- 8. DEBTS (HUTANG & PIUTANG)
CREATE TABLE IF NOT EXISTS public.debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('debt', 'receivable')),
    person_name TEXT NOT NULL,
    total_amount NUMERIC(15,2) NOT NULL,
    paid_amount NUMERIC(15,2) DEFAULT 0 NOT NULL,
    due_date DATE,
    is_settled BOOLEAN DEFAULT false NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. DEBT_PAYMENTS (RIWAYAT CICILAN HUTANG/PIUTANG)
CREATE TABLE IF NOT EXISTS public.debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. ASSETS (ASET BERHARGA)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('gold', 'investment', 'property', 'valuable', 'savings')),
    name TEXT NOT NULL,
    estimated_value NUMERIC(15,2) DEFAULT 0 NOT NULL,
    linked_pocket_id UUID REFERENCES public.pockets(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Policy Profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Policy Pockets
CREATE POLICY "Users can CRUD own pockets" ON public.pockets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Categories
CREATE POLICY "Users can CRUD own categories" ON public.categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Transactions
CREATE POLICY "Users can CRUD own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Transaction Archives
CREATE POLICY "Users can CRUD own transaction archives" ON public.transaction_archives FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Budgets
CREATE POLICY "Users can CRUD own budgets" ON public.budgets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Debts
CREATE POLICY "Users can CRUD own debts" ON public.debts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Debt Payments
CREATE POLICY "Users can CRUD own debt payments" ON public.debt_payments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Policy Assets
CREATE POLICY "Users can CRUD own assets" ON public.assets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- AUTOMATIC TRIGGER ON SIGNUP: DEFAULT POCKET & DEFAULT CATEGORIES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    raw_user_name TEXT;
    raw_full_name TEXT;
BEGIN
    raw_user_name := COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1));
    raw_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', raw_user_name);

    -- 1. Insert Profile
    INSERT INTO public.profiles (id, username, full_name)
    VALUES (NEW.id, raw_user_name, raw_full_name)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Insert Default Pocket: "Dompet Utama"
    INSERT INTO public.pockets (user_id, name, initial_balance, icon, color, order_index)
    VALUES (NEW.id, 'Dompet Utama', 0, 'fa-wallet', '#5b55f9', 0);

    -- 3. Insert Default Categories
    INSERT INTO public.categories (user_id, name, type, icon, color) VALUES
    (NEW.id, 'Makanan & Minuman', 'expense', 'fa-utensils', '#ef4444'),
    (NEW.id, 'Transportasi', 'expense', 'fa-car', '#3b82f6'),
    (NEW.id, 'Belanja', 'expense', 'fa-shopping-bag', '#ec4899'),
    (NEW.id, 'Tagihan & Utilitas', 'expense', 'fa-file-invoice-dollar', '#f59e0b'),
    (NEW.id, 'Hiburan', 'expense', 'fa-gamepad', '#8b5cf6'),
    (NEW.id, 'Kesehatan', 'expense', 'fa-heartbeat', '#10b981'),
    (NEW.id, 'Gaji', 'income', 'fa-money-bill-wave', '#10b981'),
    (NEW.id, 'Bonus & Hadiah', 'income', 'fa-gift', '#6366f1'),
    (NEW.id, 'Investasi', 'income', 'fa-chart-line', '#06b6d4'),
    (NEW.id, 'Lain-lain', 'income', 'fa-coins', '#84cc16');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger firing on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- FUNCTION: ARCHIVE TRANSACTIONS OF PREVIOUS YEARS
-- Memindahkan transaksi tahun tertentu ke tabel arsip untuk menjaga performa
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.archive_old_transactions(p_year INTEGER)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Salin ke tabel arsip
    WITH moved_rows AS (
        DELETE FROM public.transactions
        WHERE user_id = auth.uid()
          AND EXTRACT(YEAR FROM date) = p_year
        RETURNING *
    )
    INSERT INTO public.transaction_archives (
        id, user_id, pocket_id, destination_pocket_id, category_name,
        type, amount, date, notes, reference_id, reference_type, created_at
    )
    SELECT
        id, user_id, pocket_id, destination_pocket_id, category_name,
        type, amount, date, notes, reference_id, reference_type, created_at
    FROM moved_rows;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

