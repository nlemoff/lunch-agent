import { DatabaseSync } from "node:sqlite";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const DB_PATH = join(root, "app.db");

export function resetDb() {
  rmSync(DB_PATH, { force: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec(readFileSync(join(root, "db/schema.sql"), "utf8"));
  db.exec(readFileSync(join(root, "db/seed.sql"), "utf8"));
  db.close();
}

if (!existsSync(DB_PATH)) resetDb();

export const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");
