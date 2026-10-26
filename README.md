# Daily Fuel — Family Cloud + Offline

A minimalist React/Vite protein and calorie tracker with **two modes**:

- **Family cloud:** Email/password accounts, create/join family via invite code, family-wide read access, own-entry write access, admin member removal, per-member daily goals. Cloud data syncs across devices.
- **Offline tracker:** The original feature-rich family tracker (custom foods, quick log, local backups). Data remains local to this browser.

## Start

1. Install Node.js 20.19+ or 22.12+.
2. Run `npm install`.
3. Create a Supabase project, open its SQL Editor, and execute `supabase/schema.sql`.
4. Copy `.env.example` to `.env` and fill in your project's URL and **publishable/anon key** from Supabase project settings. **Never put the service_role key in frontend code.**
5. Enable Email authentication in Supabase. If email confirmation is on, confirm the email before signing in.
6. Run `npm run dev` (or `npm run build` to produce a deployable `dist/`).

Without Supabase settings, the app offers an offline-tracker button. Cloud and offline logs are intentionally separate; there is **no automatic migration or sync** between modes. Back up existing offline logs before switching. Cloud mode currently supports built-in foods, portion quantities, daily entries, and personal goals; offline custom foods and quick logging are not yet connected to cloud storage.

## Access rules

- Every signed-in family member can read all members' nutrition progress and logs in their family.
- **Only the log owner can add, edit, or delete their entries**, including against direct database requests (RLS).
- Each person can update only their own profile name and goals. The admin can remove other members but cannot modify their food logs.
- Family invitations use a shareable code, not email delivery. Treat it like a secret: anyone with the code and an account can join. Rotate the code manually in the database if leaked.
- The first member creating a family is its admin. Removing members does not delete their food history, but removes access to the former family's shared data. Each account belongs to one family at a time.

## Notes

Nutrition values are estimates. No personalized medical nutrition advice is provided. Cloud data is hosted by your configured Supabase project. SQL setup and credentials are required; the project does not ship with a backend or live Supabase instance.

## Privacy controls (new)
The Family Cloud dashboard has **Clear my food history** and **Delete my account permanently** under Privacy & data.

For account deletion, deploy the included Edge Function from the project directory using the Supabase CLI (install CLI separately if needed):

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy delete-my-account
```

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to hosted Edge Functions. **Never add the service-role key to `.env` in React.** Keep JWT verification enabled for this function. The function checks the signed-in user itself and requires explicit `DELETE` confirmation. Existing database foreign keys cascade personal rows when an auth user is deleted. Family admins must remove other family members first. If an admin's family is empty, its family record is removed before the auth account. In the unlikely event that auth deletion fails after family removal, retry deletion; the account may remain without a family. This deletes cloud data, not offline browser data, exported backups, or Supabase-managed backups.


## Install Daily Fuel on a phone (PWA)

1. Add a `.env` file containing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (your publishable key). Never include a service-role key.
2. Run `npm install` then `npm run build`. Deploy the generated `dist/` directory to an HTTPS static host.
3. On Android, open the HTTPS site in Chrome and choose **Install app** (or **Add to Home screen**). On iPhone, open in Safari, tap **Share**, then **Add to Home Screen**.
4. Configure the deployed URL in Supabase Authentication → URL Configuration (Site URL and allowed Redirect URLs), so email verification redirects to the deployed app.

The PWA includes a manifest, app icons and a service worker that caches the app shell and static assets only. It does **not** cache Supabase responses or provide offline cloud writes. The offline tracker still uses browser-local data, which is not synced across devices. The service worker is registered only in production.
