# Supabase Database Setup Guide

Your Supabase credentials have been updated. Now you need to set up the database tables.

## Quick Setup Steps

### Step 1: Enable Email Authentication (REQUIRED)

**This is the most important step!**

1. Go to: https://supabase.com/dashboard/project/xsaikzoixwhvipobnijt/auth/providers
2. Find **Email** in the providers list
3. Click to expand Email settings
4. Toggle **"Enable Email provider"** to ON
5. Scroll down and find "Confirm email" - Toggle it OFF (so users don't need email verification)
6. Click **Save** at the bottom

### Step 2: Set Up Database Tables

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project: https://xsaikzoixwhvipobnijt.supabase.co
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy and paste the contents of `supabase/migrations/20260126125933_ce6c0ccc-62d3-49c1-8f57-47128bc09f1e.sql`
5. Click **Run** to execute the migration
6. Repeat for `supabase/migrations/20260127161602_0f9387c7-cb2d-4690-841c-ba2f40d2e5ab.sql`

#### Option B: Using Supabase CLI

If you have Supabase CLI installed:

```bash
# Link to your project
npx supabase link --project-ref xsaikzoixwhvipobnijt

# Push migrations
npx supabase db push
```

## Verify Setup

After running migrations:
1. Go to **Table Editor** in Supabase Dashboard
2. You should see these tables:
   - profiles
   - wallets
   - transactions
   - user_roles
   - push_subscriptions

## Test Signup

1. Restart your dev server (the app should already be running)
2. Try to sign up with a phone number
3. Check browser console (F12) for any error messages
4. The error messages will now be more detailed

## Common Issues

**"Email signups are disabled"**
- Solution: Enable Email provider in Authentication > Providers (see Step 1 above)

**"relation 'public.profiles' does not exist"**
- Solution: Run the migration files in the SQL Editor (see Step 2 above)

**"User already registered"**
- Solution: This email/phone is already taken, try a different number

**"Failed to create account"**
- Solution: Check if email confirmation is disabled in Auth settings
