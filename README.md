# Finance Tracker — Deployment Guide

A personal finance tracker built with React + Supabase, deployable to Vercel for free.

---

## Step 1 — Set up Supabase (the database, ~5 min)

1. Go to **https://supabase.com** and create a free account
2. Click **New Project** — give it a name like "finance-tracker"
3. Wait ~1 min for it to provision
4. In the left sidebar, click **SQL Editor**
5. Paste the contents of `supabase-schema.sql` and click **Run**
6. Go to **Project Settings → API**
7. Copy two values — you'll need them in Step 3:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon / public key** (long string starting with `eyJ...`)

---

## Step 2 — Deploy to Vercel (~5 min)

### Option A: Deploy via GitHub (recommended)

1. Create a free account at **https://github.com** if you don't have one
2. Create a new repository called `finance-tracker`
3. Upload all the files from this folder to that repo
   (or use: `git init && git add . && git commit -m "init" && git remote add origin <your-repo-url> && git push`)
4. Go to **https://vercel.com** and sign in with GitHub
5. Click **Add New → Project**
6. Import your `finance-tracker` repository
7. Vercel will auto-detect it as a React app — click **Deploy**

### Option B: Deploy via Vercel CLI

```bash
npm install -g vercel
cd finance-tracker
vercel
```

---

## Step 3 — Add environment variables

After deploying (or before, in Vercel's project settings):

1. In Vercel, go to your project → **Settings → Environment Variables**
2. Add these two variables:

| Name | Value |
|------|-------|
| `REACT_APP_SUPABASE_URL` | Your Supabase Project URL |
| `REACT_APP_SUPABASE_ANON_KEY` | Your Supabase anon key |

3. Go to **Deployments** and click **Redeploy** for the variables to take effect

---

## Step 4 — Share with friends

- Your app will be live at something like `https://finance-tracker-yourname.vercel.app`
- Share the link with friends
- Each person enters their own name/ID at the login screen
- Their data is saved separately in Supabase under their ID

---

## How the data works

- Each user's data is stored as a single JSON blob in Supabase, keyed by their user ID (just a name they pick)
- Auto-saves ~1 second after any change
- No passwords — it's trust-based (anyone who knows your ID can see your data)
- If you want proper login, Supabase has built-in auth you can add later

---

## File structure

```
finance-tracker/
├── public/
│   └── index.html
├── src/
│   ├── index.js          # React entry point
│   ├── App.js            # Main app (all tabs)
│   └── supabase.js       # DB save/load helpers
├── supabase-schema.sql   # Run this in Supabase once
├── .env.example          # Copy to .env.local for local dev
└── package.json
```

## Local development

```bash
cp .env.example .env.local
# Fill in your Supabase credentials in .env.local
npm install
npm start
```
