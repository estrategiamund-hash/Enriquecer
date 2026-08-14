-- SQL Setup Script for Supabase Persistence
-- Execute this script in your Supabase SQL Editor to create the necessary tables.

-- 1. Create the 'records' table
CREATE TABLE IF NOT EXISTS records (
    id UUID PRIMARY KEY,
    filename TEXT,
    stored_file TEXT,
    type TEXT,
    available_fields JSONB,
    preview JSONB,
    total_in INT,
    total_enriched INT,
    columns JSONB,
    invalid_phone_count INT,
    invalid_phones JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable row level security (RLS) or disable for testing
ALTER TABLE records DISABLE ROW LEVEL SECURITY;

-- 2. Create the 'queue' table
CREATE TABLE IF NOT EXISTS queue (
    id UUID PRIMARY KEY,
    record_id UUID,
    queue_number TEXT,
    requester_name TEXT,
    observacoes TEXT,
    filename TEXT,
    status TEXT,
    total_rows INT,
    processed_count INT,
    success_count INT,
    error_count INT,
    request_time TEXT,
    completed_at TEXT,
    summary_name TEXT,
    selected_fields JSONB,
    detected_type TEXT,
    rows JSONB,
    logs JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE queue DISABLE ROW LEVEL SECURITY;

-- 3. Create the 'notifications' table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY,
    title TEXT,
    message TEXT,
    time TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
