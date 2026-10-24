import "server-only";
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { migrieren } from "./schema";

// Eine SQLite-Datei. Pfad über DATABASE_PATH, Standard ./data/mz-coach.db
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  const pfad = process.env.DATABASE_PATH ?? "./data/mz-coach.db";
  mkdirSync(dirname(pfad), { recursive: true });
  db = new Database(pfad);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrieren(db);
  return db;
}
