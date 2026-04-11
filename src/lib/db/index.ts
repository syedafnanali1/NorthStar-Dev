// src/lib/db/index.ts
// Database connection using Neon serverless + Drizzle ORM
// This is the ONLY place the database connection is created

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/drizzle/schema";

const connectionString = process.env["DATABASE_URL"];

export const isDatabaseConfigured = Boolean(connectionString);

const sql = connectionString ? neon(connectionString) : undefined;

export const db = connectionString && sql
  ? drizzle(sql, {
      schema,
      logger: process.env["NODE_ENV"] === "development",
    })
  : (null as unknown as ReturnType<typeof drizzle>);

export function getDb() {
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Please copy .env.example to .env.local and fill in your Neon database URL."
    );
  }

  return db;
}

export type Database = typeof db;
