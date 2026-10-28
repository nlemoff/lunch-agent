import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { db } from "./src/db.js";
import { MODEL, startAgent } from "./src/agent.js";

if (!process.env.OPENROUTER_API_KEY) {
  console.error("Missing OPENROUTER_API_KEY. Add it to .env, or as a Codespaces secret.");
  process.exit(1);
}

const PORT = Number(process.env.PORT ?? 3000);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

const parseOrder = (order) => order && { ...order, items: JSON.parse(order.items) };
const ORDER_SELECT = `SELECT o.*, r.name AS restaurant_name, r.distance_miles, r.rating, r.review_count
  FROM orders o JOIN restaurants r ON r.id = o.restaurant_id`;

async function readBody(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return JSON.parse(body || "{}");
}

// Each route is [method, path pattern, handler]. Handlers return the JSON body to send.
const routes = [
  ["GET", /^\/api\/office$/, () => db.prepare("SELECT * FROM office WHERE id = 1").get()],

  [
    "PUT",
    /^\/api\/office$/,
    async (req) => {
      const { name, address, headcount, budget_per_person, dietary_notes } = await readBody(req);
      db.prepare("UPDATE office SET name = ?, address = ?, headcount = ?, budget_per_person = ?, dietary_notes = ? WHERE id = 1").run(
        name,
        address,
        headcount,
        budget_per_person,
        dietary_notes,
      );
      return db.prepare("SELECT * FROM office WHERE id = 1").get();
    },
  ],

  [
    "POST",
    /^\/api\/runs$/,
    async (req) => {
      const { request } = await readBody(req);
      return { runId: startAgent(request) };
    },
  ],

  [
    "GET",
    /^\/api\/runs$/,
    () =>
      db
        .prepare(
          `SELECT r.*, COUNT(s.id) AS step_count, SUM(s.error IS NOT NULL) AS error_count
           FROM runs r LEFT JOIN run_steps s ON s.run_id = r.id GROUP BY r.id ORDER BY r.id DESC`,
        )
        .all(),
  ],

  [
    "GET",
    /^\/api\/runs\/(\d+)$/,
    (req, [id]) => ({
      run: db.prepare("SELECT * FROM runs WHERE id = ?").get(id),
      steps: db.prepare("SELECT * FROM run_steps WHERE run_id = ? ORDER BY id").all(id),
      order: parseOrder(db.prepare(`${ORDER_SELECT} WHERE o.run_id = ? ORDER BY o.id DESC LIMIT 1`).get(id)),
    }),
  ],

  ["GET", /^\/api\/restaurants$/, () => db.prepare("SELECT id, name, cuisine FROM restaurants").all()],

  ["GET", /^\/api\/restaurants$/, () => db.prepare("SELECT id, name, cuisine FROM restaurants").all()],

  ["GET", /^\/api\/orders$/, () => db.prepare(`${ORDER_SELECT} ORDER BY o.id DESC`).all().map(parseOrder)],

  [
    "POST",
    /^\/api\/orders\/(\d+)\/(place|cancel)$/,
    (req, [id, action]) => {
      db.prepare("UPDATE orders SET status = ? WHERE id = ? AND status = 'proposed'").run(
        action === "place" ? "placed" : "cancelled",
        id,
      );
      return parseOrder(db.prepare(`${ORDER_SELECT} WHERE o.id = ?`).get(id));
    },
  ],
];

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://${req.headers.host}`);

  for (const [method, pattern, handler] of routes) {
    const match = pathname.match(pattern);
    if (req.method !== method || !match) continue;
    try {
      const body = await handler(req, match.slice(1));
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(body));
    } catch (err) {
      console.error(err);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  try {
    const content = readFileSync(join(import.meta.dirname, "public", file.replaceAll("..", "")));
    res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "text/plain", "Cache-Control": "no-store" });
    res.end(content);
  } catch {
    res.writeHead(404).end("Not found");
  }
}).listen(PORT, () => {
  console.log(`Lunch Agent running at http://localhost:${PORT} (model: ${MODEL})`);
});
