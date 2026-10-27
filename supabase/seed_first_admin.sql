-- =====================================================================
-- Seed the FIRST admin
-- 1) Supabase Dashboard > Authentication > Users > "Add user" > "Create new user"
--    Enter email + password and TICK "Auto Confirm User".
-- 2) Put that same email below and run this in the SQL Editor.
-- =====================================================================
insert into public.admins (user_id, email)
select id, email from auth.users
where email = 'boss@example.com'          -- <-- CHANGE THIS to the email you created
on conflict (user_id) do nothing;

-- Verify (should return 1 row):
select * from public.admins;
