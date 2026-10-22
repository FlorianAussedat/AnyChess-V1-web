-- PREPARED ONLY. NOT EXECUTED. Requires explicit approval and schema inspection.
-- Additive compatibility fix for a table created before PR 05.
-- Does not touch payload, owner, document keys, timestamps, policies or grants.
-- Not a server-enforced CAS upgrade: old clients can still write unconditionally.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
  IF to_regclass('public.user_documents') IS NULL THEN
    RAISE EXCEPTION 'user_documents absent: inspect installation before proceeding';
  END IF;
END $$;
ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
-- Refuse to repurpose an incompatible existing column or reset its values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='user_documents'
      AND column_name='revision' AND data_type='bigint'
  ) THEN
    RAISE EXCEPTION 'Existing revision column has incompatible type; no changes committed';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_documents WHERE revision IS NULL OR revision < 1) THEN
    RAISE EXCEPTION 'Invalid existing revisions: inspect separately; no automatic overwrite';
  END IF;
END $$;
ALTER TABLE public.user_documents ALTER COLUMN revision SET DEFAULT 1;
ALTER TABLE public.user_documents ALTER COLUMN revision SET NOT NULL;
NOTIFY pgrst, 'reload schema';
COMMIT;
-- Do not DROP the column for rollback: clients and revisions may already use it.
