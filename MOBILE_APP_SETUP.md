# NorthStar — Mobile App Setup Guide

This guide covers building and submitting NorthStar to the **Apple App Store** and **Google Play Store** using [Capacitor](https://capacitorjs.com/).

---

## Architecture

NorthStar uses a **hybrid native app** approach:

```
┌─────────────────────────────────────────┐
│  iOS / Android Native Shell (Capacitor) │
│  ┌─────────────────────────────────────┐│
│  │  WebView → your deployed Next.js    ││
│  │  app (Vercel / Railway / Fly.io)    ││
│  └─────────────────────────────────────┘│
└─────────────────────────────────────────┘
```

- The **backend** (API routes, auth, database) stays on your server
- The **native app** is a WebView shell with native plugins (haptics, status bar, splash screen)
- All features work identically — no feature rewrites needed

---

## Prerequisites

### For Android (Windows or Mac)
- [Android Studio](https://developer.android.com/studio) installed
- JDK 17+ installed
- Android SDK installed (via Android Studio)

### For iOS (Mac only — required by Apple)
- macOS with [Xcode 15+](https://apps.apple.com/app/xcode/id497799835)
- Apple Developer account ($99/year) — [developer.apple.com](https://developer.apple.com)
- CocoaPods: `sudo gem install cocoapods`

---

## Step 1: Configure Your Production URL

Edit [capacitor.config.ts](capacitor.config.ts) and set your deployed app URL:

```typescript
server: {
  url: "https://northstar-saas.vercel.app",  // ← your production URL
  cleartext: false,
  androidScheme: "https",
},
```

For **local development**, use:
```typescript
server: {
  url: "http://localhost:3000",
}
```

---

## Step 2: Initialize Capacitor Native Projects

Run these once to create the native project directories:

```bash
# Initialize Capacitor (already configured via capacitor.config.ts)
npx cap init NorthStar com.northstar.goaltracker --web-dir public

# Add iOS platform (requires macOS + Xcode)
npx cap add ios

# Add Android platform
npx cap add android
```

This creates `ios/` and `android/` folders.

---

## Step 3: Sync Web Code to Native Projects

After any code changes:

```bash
npm run mobile:build
# or manually:
npm run build && npx cap sync
```

---

## Step 4: App Icons & Splash Screen

### Generate icons from a single 1024×1024 PNG source

1. Place your master icon at `public/icons/icon-1024.png`
   - Use a square image with NO transparency (App Store requirement)
   - Background color: `#1A1714` (the app's dark ink color)
   - Gold star centered

2. Use [Capacitor Assets](https://capacitorjs.com/docs/guides/splash-screens-and-icons) to auto-generate all sizes:

```bash
npm install @capacitor/assets --save-dev

# Generate all icon and splash screen sizes
npx capacitor-assets generate --assetPath public/icons/icon-1024.png
```

Or use [AppIcon.co](https://appicon.co) / [MakeAppIcon](https://makeappicon.com) to generate all sizes manually.

Required icon sizes:

| Platform | Sizes needed |
|----------|-------------|
| iOS      | 20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024 |
| Android  | 48, 72, 96, 144, 192 (+ adaptive icons) |

### Splash Screen

Place a `2732×2732` PNG at `public/icons/splash-2732.png`:
- Dark background: `#1A1714`
- Centered gold star logo (~300px)

---

## Step 5: Build & Open in IDE

### Android

```bash
npm run cap:android
# Opens Android Studio — build & run from there
```

In Android Studio:
1. **Build → Generate Signed Bundle/APK**
2. Choose **Android App Bundle (.aab)** for Play Store
3. Create or use existing keystore
4. Build release variant

### iOS (macOS only)

```bash
npm run cap:ios
# Opens Xcode — build & run from there
```

In Xcode:
1. Select your team in **Signing & Capabilities**
2. Set bundle identifier: `com.northstar.goaltracker`
3. **Product → Archive** to create a release build
4. Upload via **Xcode Organizer → Distribute App**

---

## Step 6: App Store Submission

### Apple App Store

1. Create app in [App Store Connect](https://appstoreconnect.apple.com)
   - Bundle ID: `com.northstar.goaltracker`
   - Primary language: English
   - Category: **Productivity**

2. Required assets:
   - App icon: 1024×1024 PNG (no alpha)
   - Screenshots: 6.7" (iPhone 15 Pro Max), 5.5" (iPhone 8 Plus), iPad Pro 12.9"
   - App Preview video (optional but recommended)

3. App Store listing:
   - **Name**: NorthStar — Goal Tracker
   - **Subtitle**: Build habits. Track progress.
   - **Keywords**: goal tracker, habit tracker, accountability, productivity, daily log
   - **Privacy Policy URL**: Required

4. Submit for review (~1-3 business days)

### Google Play Store

1. Create app in [Google Play Console](https://play.google.com/console)
   - Package name: `com.northstar.goaltracker`
   - App category: **Productivity**

2. Required assets:
   - App icon: 512×512 PNG
   - Feature graphic: 1024×500 PNG
   - Screenshots: Phone (min 2), Tablet (recommended)

3. Upload signed `.aab` file

4. Complete store listing, content rating, pricing
5. Submit for review (~2-7 business days)

---

## Step 7: App Store-Specific Configurations

### iOS — `ios/App/App/Info.plist` additions

Add these after Capacitor auto-generates the file:

```xml
<!-- Allow loading from your server domain -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  <key>NSExceptionDomains</key>
  <dict>
    <key>your-app.vercel.app</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <false/>
      <key>NSIncludesSubdomains</key>
      <true/>
    </dict>
  </dict>
</dict>

<!-- Camera (for profile photo uploads) -->
<key>NSCameraUsageDescription</key>
<string>NorthStar uses your camera to update your profile photo.</string>

<!-- Photo library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>NorthStar accesses your photos to set your profile picture.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

Capacitor auto-generates this. Confirm these permissions are present:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
```

---

## Development Workflow

```bash
# 1. Start Next.js dev server
npm run dev

# 2. In another terminal, run on device/emulator
npm run cap:run:android   # Android
npm run cap:run:ios       # iOS (Mac only)

# 3. After code changes
npm run cap:sync          # Syncs without full rebuild
```

### Live Reload during development

In `capacitor.config.ts`, set `server.url` to your local network IP:
```typescript
server: {
  url: "http://192.168.1.X:3000",  // your machine's local IP
  cleartext: true,  // allow HTTP on dev only
}
```

---

## Native Plugins Used

| Plugin | Purpose |
|--------|---------|
| `@capacitor/haptics` | Tactile feedback on nav taps and actions |
| `@capacitor/status-bar` | Transparent status bar, dark/light style |
| `@capacitor/splash-screen` | Branded launch screen |
| `@capacitor/keyboard` | Keyboard resize behavior |
| `@capacitor/app` | App lifecycle, back button handling |

---

## App Store Review Notes

Apple and Google both allow **WebView-based apps** as long as:
- The app provides **genuine value** beyond a website (you do — goals, social, AI coaching)
- The WebView loads your **own content** (not third-party sites)
- Login and payments use native flows or Apple/Google's requirements

NorthStar qualifies easily since it has rich interactive features and doesn't just wrap a marketing page.

---

## Checklist Before Submission

- [ ] Production URL set in `capacitor.config.ts`
- [ ] App icons generated (all sizes)
- [ ] Splash screen created
- [ ] Privacy Policy URL live
- [ ] App Store screenshots taken on real device or simulator
- [ ] Tested on iOS 16+ and Android 10+
- [ ] Dark mode verified
- [ ] Safe area tested on iPhone with notch/Dynamic Island
- [ ] Tested on iPad (in scaled phone mode)
- [ ] Push notification entitlement added (if using notifications)
- [ ] App signed with release certificate/keystore
