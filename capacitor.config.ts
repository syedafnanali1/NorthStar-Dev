import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.northstar.goaltracker",
  appName: "NorthStar",
  // Use the local Next.js dev server when running in development.
  // On Android emulator, 10.0.2.2 maps to the host machine.
  // For physical devices, replace with your machine IP (e.g. http://192.168.x.x:3000).
  server: {
    url:
      process.env.NODE_ENV === "development"
        ? "http://10.0.2.2:3000"
        : process.env.NEXT_PUBLIC_APP_URL || "https://northstar-saas.vercel.app",
    cleartext: process.env.NODE_ENV === "development",
    androidScheme: "https",
  },
  // webDir is required by Capacitor even when using server.url
  webDir: "public",
  ios: {
    scheme: "NorthStar",
    contentInset: "always",
    scrollEnabled: false,
    limitsNavigationsToAppBoundDomains: true,
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      backgroundColor: "#1A1714",
      iosSpinnerStyle: "small",
      spinnerColor: "#C4963A",
      showSpinner: false,
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "Dark",
      backgroundColor: "#1A1714",
      overlaysWebView: true,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
