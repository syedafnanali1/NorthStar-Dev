// src/lib/db/index.ts
// Database connection using Neon serverless + Drizzle ORM
// This is the ONLY place the database connection is created

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/drizzle/schema";

const connectionString = process.env["DATABASE_URL"];

if (!connectionString) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
      "Please copy .env.example to .env.local and fill in your Neon database URL."
  );
}

const sql = neon(connectionString);

export const db = drizzle(sql, {
  schema,
  logger: process.env["NODE_ENV"] === "development",
});

export type Database = typeof db;
