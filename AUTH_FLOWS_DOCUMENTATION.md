# NorthStar Authentication Flows - Complete Guide

## Deployment Status
✅ **Code pushed to GitHub**: https://github.com/syedafnanali1/NorthStar-Dev  
✅ **Deployed to Vercel**: https://northstar-saas.vercel.app/  
✅ **All environment variables configured**  
✅ **Latest build successful**

## Authentication Methods Supported

### 1. Google OAuth Sign-In
**URL**: `https://northstar-saas.vercel.app/auth/login`

**Flow**:
1. User clicks "Sign in with Google"
2. Redirected to Google authorization
3. User grants permission
4. System triggers **step-up verification** if:
   - First login on this device, OR
   - 7+ days since last verification
5. **Verification email sent** with 6-digit code
6. User verifies with code at `/auth/verify-email`
7. Access granted

**Email Sent**: 
- Subject: "New sign-in attempt - confirm it's you"
- Contains: 6-digit OTP code + verification link
- Includes: Device (Google OAuth), timestamp

**Step-Up Requirements**:
- New device (first login today) → Verification required
- Existing device BUT after 7 days → Verification required
- Same device, same day → No verification needed

---

### 2. Facebook OAuth Sign-In
**URL**: `https://northstar-saas.vercel.app/auth/login`

**Flow**:
1. User clicks "Sign in with Facebook"
2. Redirected to Facebook authorization
3. User grants permission
4. **Step-up verification triggered** (same rules as Google)
5. **Verification email sent** with 6-digit code
6. User verifies with code at `/auth/verify-email`
7. Access granted

**Email Sent**:
- Subject: "New sign-in attempt - confirm it's you"
- Contains: 6-digit OTP code + verification link
- Includes: Device (Facebook), timestamp

---

### 3. Email & Password Registration
**URL**: `https://northstar-saas.vercel.app/auth/register`

**Flow**:
1. User enters: Full name, email, password, phone, DOB, country
2. Optional: Username (auto-generated if omitted)
3. Account created in database
4. **Email verification OTP created** (6 digits, expires in 10 minutes)
5. **Confirmation email sent** with:
   - 6-digit verification code
   - Direct click-to-verify link
6. User verifies email at `/auth/verify-email` or clicks email link
7. Account activated
8. Can now login with email/password

**Email Sent**:
- Subject: "Verify your email - NorthStar"
- Contains: 6-digit code + one-click verification link
- Also includes text version via email

**Verification Requirements**:
- OTP must be 6 digits
- Code expires in 10 minutes
- Can resend after 60-second cooldown
- Maximum 3 attempts per code

---

### 4. Email & Password Login
**URL**: `https://northstar-saas.vercel.app/auth/login`

**Flow**:
1. User enters email and password
2. System validates credentials
3. Checks if email is verified
4. **Only proceeds if**:
   - Email & password match
   - Email has been verified
   - Account is not locked (after failed attempts)
5. Access granted
6. Session created (30-day lifespan via JWT)

**Security Features**:
- Failed login attempts tracked
- Account locks after 5 failed attempts
- Lock duration: 15 minutes
- Password stored with bcrypt (12 salt rounds)

---

### 5. Email Verification (Core Endpoint)

**Endpoint**: `POST /api/auth/verify-email`

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "mode": "email" | "signin",  // "email" for registration, "signin" for OAuth step-up
  "provider": "google" | "facebook"  // Only for mode="signin"
}
```

**Response (Success)**:
```json
{
  "success": true,
  "code": "VERIFICATION_SUCCESS",
  "user": {
    "id": "usr_...",
    "email": "user@example.com",
    "emailVerified": true
  },
  "redirectTo": "/dashboard"
}
```

**Response (Failure)**:
```json
{
  "success": false,
  "code": "INVALID_CODE" | "CODE_EXPIRED",
  "message": "Invalid or expired verification code."
}
```

**Validation Rules**:
- OTP must be exactly 6 digits
- Must be verified within 10 minutes
- Each code can only be used once
- Email must be normalized (lowercase)

---

### 6. Verification Email Resend

**Endpoint**: `POST /api/auth/resend-verification`

**Request Body**:
```json
{
  "email": "user@example.com",
  "mode": "email" | "signin"  // optional, defaults to "email"
}
```

**Response**:
```json
{
  "success": true,
  "message": "New verification code sent to your email.",
  "resendAfterSeconds": 60
}
```

**Cooldown Rules**:
- Must wait 60 seconds between resend requests
- Maximum 3 resend attempts per hour
- New OTP code generated each time
- Old codes remain expired

---

## Email Configuration

**Email Provider**: Resend API  
**From Address**: `${EMAIL_FROM}` (configured in Vercel)  
**Retry Logic**: 
- 3 automatic retry attempts
- Exponential backoff (400ms, 800ms, 1600ms)
- Graceful failure with detailed logging

**Failed Email Handling**:
- Google/Facebook OAuth errors are logged with userId, email, provider
- Registration errors provide clear user feedback
- Users can resend verification if email delivery fails
- All errors logged in Vercel deployment logs

---

## Environment Variables (Production)

All configured in Vercel:
```
✓ DATABASE_URL           – Neon PostgreSQL connection
✓ AUTH_SECRET            – NextAuth.js JWT signing key
✓ NEXTAUTH_URL           – https://northstar-saas.vercel.app
✓ NEXT_PUBLIC_APP_URL    – https://northstar-saas.vercel.app
✓ GOOGLE_CLIENT_ID       – Google Cloud Console OAuth2 ID
✓ GOOGLE_CLIENT_SECRET   – Google Cloud Console OAuth2 secret
✓ FACEBOOK_CLIENT_ID     – Facebook Developer app ID
✓ FACEBOOK_CLIENT_SECRET – Facebook Developer app secret
✓ RESEND_API_KEY         – Resend.io email API key
✓ EMAIL_FROM             – Sender address (e.g., hello@northstar.app)
```

---

## Testing Checklist

### Google OAuth
- [ ] Click "Sign in with Google"
- [ ] Authorize via Google
- [ ] Receive verification email with code
- [ ] Enter code on verify-email page
- [ ] Successfully logged in
- [ ] Next login within 7 days: No verification needed

### Facebook OAuth
- [ ] Click "Sign in with Facebook"
- [ ] Authorize via Facebook
- [ ] Receive verification email with code
- [ ] Enter code on verify-email page
- [ ] Successfully logged in

### Email Registration
- [ ] Fill registration form
- [ ] Receive confirmation email with 6-digit code
- [ ] Click email link OR enter code manually
- [ ] Email verified, account activated
- [ ] Try login with email/password
- [ ] Successfully logged in

### Regular Login
- [ ] Enter registered email
- [ ] Enter password
- [ ] Successfully logged in (if email was verified)

### Error Cases
- [ ] Expired code → "Code expired" message
- [ ] Wrong code → "Invalid code" message, try again
- [ ] Resend code → 60-second cooldown enforced
- [ ] Wrong password → Account lock after 5 attempts
- [ ] Unverified email → Can't login, must verify first

---

## API Endpoints Reference

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | GET | Login page |
| `/auth/register` | GET | Registration page |
| `/auth/verify-email` | GET | Email verification page |
| `/api/auth/register` | POST | Register new account |
| `/api/auth/verify-email` | POST | Verify OTP code |
| `/api/auth/resend-verification` | POST | Resend OTP code |
| `/api/auth/forgot-password` | POST | Initiate password reset |
| `/api/auth/reset-password` | POST | Complete password reset |
| `/api/auth/config-status` | GET | Check OAuth provider config |
| `/api/auth/[...nextauth]` | GET/POST | NextAuth handlers |

---

## Error Logging & Debugging

**To monitor issues, check Vercel deployment logs**:
1. Go to https://vercel.com
2. Select northstar-saas project
3. View "Deployments" > latest build > "Functions" logs
4. Search for:
   - `[auth]` – Authentication-related messages
   - `[auth-email]` – Email delivery logs
   - `oauth step-up` – OAuth verification flow
   - `verification_email_failed` – Email send failures

**Common Issues & Solutions**:

| Issue | Solution |
|-------|----------|
| Email not received | Check spam folder, verify Resend API key is active |
| OAuth disabled | Ensure CLIENT_ID and CLIENT_SECRET are set in Vercel |
| Code expired | Resend verification code (60-second cooldown) |
| Account locked | Wait 15 minutes after 5 failed login attempts |
| "Database unavailable" | Check DATABASE_URL in Vercel is valid |

---

## Code References

- **Auth Config**: `src/lib/auth/config.ts` (OAuth providers, step-up logic)
- **Email Service**: `src/lib/email/auth.ts` (OTP sending, retry logic)
- **Registration API**: `src/app/api/auth/register/route.ts`
- **Verification API**: `src/app/api/auth/verify-email/route.ts`
- **Resend OTP API**: `src/app/api/auth/resend-verification/route.ts`
- **Security Core**: `src/lib/auth/security-core.ts` (Account locks, attempt tracking)
- **OTP Creation**: `src/lib/auth/security.ts` (OTP generation and expiry)

---

**Last Updated**: April 11, 2026  
**Status**: ✅ Production Ready
