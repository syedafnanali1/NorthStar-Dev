// src/app/api/auth/[...nextauth]/route.ts
// Runs on Edge runtime — 25 s timeout, no Node.js cold-start penalty.
// Uses the edge-compatible NextAuth config (JWT sessions, neon HTTP for credentials).

import { handlers } from "@/lib/auth/edge-config";

export const runtime = "edge";

export const { GET, POST } = handlers;
