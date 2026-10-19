# Averi School — Version 0.2 (Supabase-connected starter)

Three separate accounts (admin parent, parent, student), shared assignments, check-ins, tests, help requests, and parent-only submission verification. Uses Supabase Auth + PostgreSQL with Row Level Security (RLS). **Not deployed or connected to Canvas/Skyward.**

## 1. Create tables and policies

In your Supabase project, open **SQL Editor → New query**. Paste the complete contents of `supabase/schema.sql` and click **Run**. Do this once on a fresh project; policies are not idempotent.

## 2. Start the app locally

Install Node.js LTS. Unzip this project and open a terminal in the `averi-school-app` directory:

```bash
cp .env.example .env
npm install
npm run dev
```

On Windows, use `copy .env.example .env` in Command Prompt or `Copy-Item .env.example .env` in PowerShell. Open the URL Vite prints, usually http://localhost:5173.

`.env.example` contains only the **public project URL and publishable key**. Never place a `service_role`, `sb_secret`, or database password in this project or Vercel frontend environment variables.

## 3. Create the three logins

In the running app, use **Sign up** to register the admin parent, Kat, and Averi with **their own email addresses**. Supabase may send confirmation emails (check inbox). Each user should sign in once. Until linked, the app displays **Waiting for family enrollment**. This is expected.

**Do not turn off RLS or give family members SQL Editor access.**

## 4. Enroll the family (SQL Editor, project owner only)

After all three users have signed up, in **SQL Editor** run the following, replacing the three placeholder emails with the actual signup emails. Do not paste passwords here. This is a **one-time administrative setup**:

```sql
do $$
declare f uuid;
declare admin_id uuid; parent_id uuid; student_id uuid;
begin
  select id into admin_id from auth.users where lower(email) = lower('ADMIN_EMAIL_HERE');
  select id into parent_id from auth.users where lower(email) = lower('KAT_EMAIL_HERE');
  select id into student_id from auth.users where lower(email) = lower('AVERI_EMAIL_HERE');
  if admin_id is null or parent_id is null or student_id is null then
    raise exception 'All three accounts must sign up before enrollment';
  end if;
  if admin_id = parent_id or admin_id = student_id or parent_id = student_id then
    raise exception 'All three accounts must be different';
  end if;
  insert into public.families(name) values ('Averi School') returning id into f;
  insert into public.memberships(user_id,family_id,role,display_name)
  values (admin_id,f,'admin','Eric'), (parent_id,f,'parent','Kat'), (student_id,f,'student','Averi');
end $$;
```

Sign out and sign in again on each device to load the new membership. This enrollment is intentionally done in the protected SQL Editor rather than exposing a public family-join endpoint.

## 5. Test with sample data

- Sign in as Averi; add a test and assignment, submit a daily check-in, and send a help request.
- Sign in as Eric or Kat in another browser; check the parent overview and mark a submission as **parent verified**. This means verified by a parent, **not** automatically checked against Canvas.
- Verify Averi cannot see the parent overview or parent verification control.
- Sign in as a fourth, uninvited account; it should remain on the enrollment screen and see no family data.

Refresh the page to see updates from other devices; automatic live subscriptions and notifications are not implemented yet.

## 6. Deploy to Vercel (after testing)

Push the project to a **private GitHub repository** (the `.env` file is ignored), import it at https://vercel.com/new, select **Vite** framework, and configure:

- `VITE_SUPABASE_URL` = the project URL from `.env.example`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable key from `.env.example`

Deploy. In Supabase **Authentication → URL Configuration**, set **Site URL** to the deployed Vercel URL and add that URL to **Redirect URLs** for authentication emails. You may also keep `http://localhost:5173/**` in allowed redirect URLs for local testing.

## Security and limitations

- RLS isolates records to the enrolled family. The student cannot create a parent verification; only admin/parent can.
- All family members can edit assignment status, which remains self-reported; parent verification is a separate record.
- Parents can read check-ins but cannot create or change them. The student can edit their own check-ins; timestamps are not immutable audit logs.
- This starter does not include file uploads, automated reminders, calendar sync, Canvas, Skyward, NotebookLM API, or ChatGPT API integration.
- Before using real school data for a minor, review parental consent, privacy expectations, retention, and school policy. Use only the minimum necessary information.
- Password reset email links may need additional URL configuration for a fully polished reset experience.
