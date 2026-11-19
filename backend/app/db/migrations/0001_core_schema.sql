-- Brightway Computer Academy Portal: Core 3-Table Schema (Strict Specification)
-- Tables: students, admins, fee_payments

DO $$
BEGIN
    -- Strip all legacy bloat tables and redundant cache/tracking layers
    DROP TABLE IF EXISTS
        student_monthly_fees,
        import_job_rows,
        import_jobs,
        audit_logs,
        app_settings,
        id_cards,
        id_card_templates,
        fee_reminders,
        notifications,
        receipts,
        payment_events,
        payments,
        fees,
        fee_plans,
        attendance,
        batch_students,
        batches,
        courses,
        teachers,
        user_profiles,
        schema_migrations
    CASCADE;

    -- Drop legacy trigger functions if present
    DROP FUNCTION IF EXISTS set_updated_at() CASCADE;
    DROP FUNCTION IF EXISTS prevent_modification() CASCADE;

    -- If legacy 'students' table exists (identifiable by 'enrollment_number' or 'initial_passcode'), drop it
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'students'
          AND column_name IN ('enrollment_number', 'initial_passcode')
    ) THEN
        DROP TABLE students CASCADE;
    END IF;
END $$;

-- Table 1: students
CREATE TABLE IF NOT EXISTS students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id text NOT NULL UNIQUE,
    name text NOT NULL,
    contact_number text NOT NULL,
    batch text NOT NULL,
    monthly_fee numeric(10, 2) NOT NULL DEFAULT 0.00,
    photo_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT students_student_id_not_blank CHECK (length(btrim(student_id)) > 0),
    CONSTRAINT students_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT students_monthly_fee_non_negative CHECK (monthly_fee >= 0)
);

CREATE INDEX IF NOT EXISTS idx_students_student_id ON students (student_id);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students (batch);

-- Table 2: admins
CREATE TABLE IF NOT EXISTS admins (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    username text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL DEFAULT 'SUPER_ADMIN',
    CONSTRAINT admins_username_not_blank CHECK (length(btrim(username)) > 0),
    CONSTRAINT admins_role_check CHECK (role IN ('SUPER_ADMIN'))
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins (username);

-- Table 3: fee_payments
CREATE TABLE IF NOT EXISTS fee_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id text NOT NULL REFERENCES students(student_id) ON DELETE CASCADE ON UPDATE CASCADE,
    amount numeric(10, 2) NOT NULL,
    month_year text NOT NULL,
    razorpay_order_id text,
    razorpay_payment_id text,
    status text NOT NULL DEFAULT 'PENDING',
    payment_date timestamptz,
    CONSTRAINT fee_payments_student_month_key UNIQUE (student_id, month_year),
    CONSTRAINT fee_payments_month_year_format CHECK (month_year ~ '^\d{4}-(0[1-9]|1[0-2])$'),
    CONSTRAINT fee_payments_status_check CHECK (status IN ('PAID', 'PENDING', 'FAILED')),
    CONSTRAINT fee_payments_amount_non_negative CHECK (amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_fee_payments_student_id ON fee_payments (student_id);
CREATE INDEX IF NOT EXISTS idx_fee_payments_month_year ON fee_payments (month_year);
CREATE INDEX IF NOT EXISTS idx_fee_payments_order_id ON fee_payments (razorpay_order_id);

