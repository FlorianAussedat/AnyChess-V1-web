-- Strictly read-only schema inspection. No user rows, payloads, IDs or secrets.
BEGIN TRANSACTION READ ONLY;
SELECT table_schema, table_name, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'user_documents'
ORDER BY ordinal_position;
SELECT conname AS constraint_name, contype AS constraint_type,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = to_regclass('public.user_documents');
SELECT c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c WHERE c.oid = to_regclass('public.user_documents');
SELECT policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_documents';
SELECT grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'user_documents'
ORDER BY grantee, privilege_type;
COMMIT;
