# Setup guide (about 20 minutes)

## 1. Create the Supabase project
1. Go to https://supabase.com, sign in, click **New project**. Pick a region close to your users. Save the database password.
2. Open **Project Settings > API** and note: **Project URL**, **anon public key**, and **service_role key** (secret; never put it in the browser or in a `VITE_` variable).

## 2. Run the SQL
1. Open **SQL Editor > New query**, paste all of `supabase/migration.sql`, click **Run**. This creates the tables, security rules, functions, and the `car-files` storage bucket with its policies.

## 3. Check the storage bucket
Open **Storage**. You should see a bucket named `car-files` marked **Public**. If it is missing, create it with that exact name and tick *Public bucket*, then re-run the policy part of the migration.

## 4. Turn off public signup
**Authentication > Sign In / Providers** (or **Settings**) > turn **off** "Allow new users to sign up". Only admins created by you or another admin can log in.

## 5. Create the first admin
1. **Authentication > Users > Add user > Create new user**. Enter email and password, tick **Auto Confirm User**.
2. Open `supabase/seed_first_admin.sql`, put that same email in it, and run it in the SQL Editor. It should return one row.

## 6. Environment variables
Copy `.env.example` to `.env` for local work. In Vercel, add the same names under **Project > Settings > Environment Variables**:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL |
| `VITE_SUPABASE_ANON_KEY` | anon public key |
| `VITE_SITE_URL` | your final domain, e.g. `https://cars.example.com` (no trailing slash) |
| `VITE_STORAGE_LIMIT_MB` | `1024` on the free plan |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (server only) |
| `CRON_SECRET` | any long random string |

## 7. Deploy to Vercel
1. Push this folder to a GitHub repository.
2. In Vercel: **Add New > Project**, import the repo. Framework: **Vite** (auto-detected), build command `npm run build`, output `dist`.
3. Add the environment variables above, then **Deploy**.
4. Add your domain under **Settings > Domains**. Set `VITE_SITE_URL` to it and redeploy.

## 8. Enable the daily cleanup
- `vercel.json` already schedules `/api/cron/cleanup` daily at 03:00 UTC. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically once `CRON_SECRET` is set. Check **Project > Settings > Cron Jobs** after deploying.
- Alternative: run `supabase/cleanup_pg_cron_alternative.sql` to schedule it from Supabase instead (remove the `crons` block from `vercel.json` if you do).
- Test any time with the **Run cleanup now** button on the dashboard.

## 9. Test it
1. Log in at `/admin/login`.
2. Create a car with a small ZIP and open the link in a private window.
3. Paste the link in WhatsApp to confirm the preview image and title appear. WhatsApp caches previews, so test with a fresh link.

## Notes
- **Free plan limits:** 1 GB total storage and 50 MB per file. The dashboard meter and upload warnings use `VITE_STORAGE_LIMIT_MB`.
- **Link privacy:** file URLs are long random paths, so they are not guessable, but anyone who has a file URL can open it, even after a car is hidden. Delete the car to remove the files.
- **Rate limiting** on `/api` functions is per serverless instance (light protection). Add Vercel Firewall rules for stronger limits.
- **Forgot the admin password?** Supabase **Authentication > Users** lets you set a new one, or ask another admin to reset it from `/admin/admins`.
