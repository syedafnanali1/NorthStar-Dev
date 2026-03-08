# ⭐ North Star — Goal Tracker

> Small actions. Extraordinary results.

A production-ready SaaS goal tracking application with Google/Facebook OAuth, daily habit logging, social accountability circle, analytics, and achievement badges.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router |
| Language | TypeScript (strict) |
| Database | PostgreSQL via Neon (serverless) |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 (Google, Facebook, email/password) |
| Validation | Zod (all inputs + env vars) |
| Email | Resend |
| SMS | Twilio |
| Styling | Tailwind CSS |
| Deployment | Vercel |

---

## Project Structure

```
northstar-saas/
├── drizzle/
│   └── schema.ts              # Complete DB schema (all tables + relations)
├── src/
│   ├── app/
│   │   ├── page.tsx           # Root redirect
│   │   ├── layout.tsx         # Root layout
│   │   ├── auth/
│   │   │   ├── login/         # Login page + form
│   │   │   ├── register/      # Register page + form
│   │   │   ├── forgot-password/
│   │   │   └── reset-password/
│   │   ├── dashboard/         # Goals overview
│   │   ├── goals/
│   │   │   ├── new/           # 3-step goal creation wizard
│   │   │   └── [id]/          # Goal detail page
│   │   ├── calendar/          # Monthly daily log
│   │   ├── analytics/         # Stats, achievements, charts
│   │   ├── circle/            # Social feed + leaderboard
│   │   ├── profile/           # Profile + invite + export
│   │   └── api/
│   │       ├── auth/          # NextAuth + register + forgot/reset password
│   │       ├── goals/         # CRUD + progress + moments
│   │       ├── daily-logs/    # Calendar log save/fetch
│   │       ├── analytics/     # Momentum + achievements
│   │       ├── circle/        # Posts + reactions
│   │       ├── invitations/   # Email + SMS invitations
│   │       └── users/me/      # Profile CRUD
│   ├── components/
│   │   ├── ui/                # ProgressRing, Skeleton, Toaster
│   │   ├── layout/            # AppLayout, Sidebar, RightPanel, Providers
│   │   ├── goals/             # GoalCard, MomentumCard, MomentModal, EmptyGoals
│   │   ├── analytics/         # Charts, Achievements, Constellation, Lifetime
│   │   ├── calendar/          # CalendarView (in app/calendar)
│   │   └── circle/            # CircleFeed (in app/circle)
│   ├── lib/
│   │   ├── auth/              # NextAuth config + server helpers
│   │   ├── db/                # Drizzle DB connection
│   │   ├── email/             # Resend email service
│   │   ├── sms/               # Twilio SMS service
│   │   ├── validators/        # Zod schemas for all inputs
│   │   └── utils/             # cn(), formatters, helpers
│   ├── server/
│   │   └── services/          # Business logic layer
│   │       ├── goals.service.ts
│   │       ├── analytics.service.ts
│   │       ├── achievements.service.ts
│   │       └── invitations.service.ts
│   ├── types/
│   │   └── next-auth.d.ts     # Session type extensions
│   ├── styles/
│   │   └── globals.css        # Design tokens + Tailwind base
│   └── middleware.ts          # Auth-protected route middleware
├── .env.example               # All required environment variables
├── drizzle.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Running Locally

### 1. Prerequisites

- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)
- **Git** — download from [git-scm.com](https://git-scm.com)

### 2. Clone and Install

```bash
# Clone the repo (or unzip the downloaded folder)
cd northstar-saas

# Install dependencies
npm install
```

### 3. Set Up Neon Database (Free)

1. Go to **[neon.tech](https://neon.tech)** and create a free account
2. Create a new project called `northstar`
3. Click **"Connect"** → copy the **Connection String** (starts with `postgresql://`)

### 4. Set Up Google OAuth

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Create a new project → **APIs & Services** → **Credentials**
3. Create **OAuth 2.0 Client ID** → Web application
4. Add Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy the **Client ID** and **Client Secret**

### 5. Set Up Facebook OAuth

1. Go to **[developers.facebook.com](https://developers.facebook.com)**
2. Create a new app → **Consumer** type
3. Add **Facebook Login** product
4. Set Valid OAuth Redirect URIs: `http://localhost:3000/api/auth/callback/facebook`
5. Copy the **App ID** and **App Secret**

### 6. Set Up Resend Email (Free)

1. Go to **[resend.com](https://resend.com)** → create account
2. Create an **API Key**
3. Add and verify your domain (or use their sandbox for testing)

### 7. Set Up Twilio SMS (Optional)

1. Go to **[twilio.com](https://twilio.com)** → create account
2. Get a trial phone number
3. Copy Account SID, Auth Token, and Phone Number
4. If you skip this, email invites still work — SMS is gracefully disabled

### 8. Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in every value. All fields are documented in the file.

Generate your `AUTH_SECRET`:
```bash
openssl rand -hex 32
```

### 9. Push Database Schema

```bash
npm run db:push
```

This creates all tables in your Neon database automatically.

### 10. Start the Dev Server

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** — you should see the North Star login page.

---

## Deploying to the Internet

### Step 1: Buy a Domain

Go to **[Namecheap](https://namecheap.com)** or **[Cloudflare Registrar](https://cloudflare.com/registrar)**.
Search for your domain (e.g., `northstar.app` or `mynorthstar.io`). Buy it (~$10–15/year).

### Step 2: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/northstar-saas.git
git push -u origin main
```

### Step 3: Deploy on Vercel (Free)

1. Go to **[vercel.com](https://vercel.com)** → sign in with GitHub
2. Click **"Add New Project"** → import your `northstar-saas` repo
3. Framework: **Next.js** (auto-detected)
4. Click **"Deploy"**

### Step 4: Add Environment Variables on Vercel

In your Vercel project → **Settings** → **Environment Variables**, add every variable from your `.env.local`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Neon connection string |
| `AUTH_SECRET` | Your 32-char random string |
| `NEXTAUTH_URL` | `https://yourdomain.com` |
| `GOOGLE_CLIENT_ID` | From Google Console |
| `GOOGLE_CLIENT_SECRET` | From Google Console |
| `FACEBOOK_CLIENT_ID` | From Facebook Developers |
| `FACEBOOK_CLIENT_SECRET` | From Facebook Developers |
| `RESEND_API_KEY` | From Resend |
| `EMAIL_FROM` | `North Star <hello@yourdomain.com>` |
| `TWILIO_ACCOUNT_SID` | From Twilio (optional) |
| `TWILIO_AUTH_TOKEN` | From Twilio (optional) |
| `TWILIO_PHONE_NUMBER` | From Twilio (optional) |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` |
| `NEXT_PUBLIC_APP_NAME` | `North Star` |

### Step 5: Connect Your Domain

1. In Vercel → **Settings** → **Domains** → add your domain
2. Vercel gives you DNS records to add
3. Go to your domain registrar → add the DNS records Vercel provides
4. Wait 5–60 minutes for DNS propagation

### Step 6: Update OAuth Redirect URIs

**Google:**
- Go back to Google Cloud Console → Credentials → your OAuth app
- Add: `https://yourdomain.com/api/auth/callback/google`

**Facebook:**
- Go back to Facebook Developers → your app → Facebook Login → Settings
- Add: `https://yourdomain.com/api/auth/callback/facebook`

### Step 7: Go Live

Redeploy on Vercel (it redeploys automatically on every git push).

Your app is live at `https://yourdomain.com` 🎉

---

## Useful Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run typecheck    # Check TypeScript errors
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Drizzle Studio (visual DB browser)
npm run db:generate  # Generate migration files
npm run db:migrate   # Run pending migrations
```

---

## Architecture Decisions

**Why every page is its own file?** Next.js App Router maps each `page.tsx` to a route — this is enforced by the framework itself. Every route in `src/app/` is completely independent.

**Why a services layer?** `src/server/services/` contains all business logic. API routes are thin — they validate input with Zod, call a service function, and return the result. Components never call the database.

**Why Drizzle over Prisma?** Drizzle is type-safe SQL — you write real SQL operators and get full TypeScript inference. No magic, no black box, no N+1 surprises.

**Why Neon?** Neon is serverless PostgreSQL — it works perfectly with Vercel's serverless functions, has a generous free tier, and supports connection pooling out of the box.

---

## Environment Variables Reference

See `.env.example` for the complete list with descriptions. Every variable is validated at startup using Zod — if anything is missing or malformed, the app tells you exactly which variable and why, instead of failing silently at runtime.
