# Lunch Agent

Lunch Agent orders lunch for an office. Someone types a request like "order me mediterranean food to feed 30 hungry engineers". The agent finds restaurants nearby, checks menus and catering capacity, prices the order, and asks the person to confirm before it's placed.

## Run it

You need Node 22.13 or later. There are no dependencies to install.

```bash
cp .env.example .env
```

Paste an OpenRouter API key into `.env`, then start the app:

```bash
npm start
```

Open http://localhost:3000. The database is created the first time the app starts. To put it back to the starting data, stop the app and run:

```bash
npm run reset-db
```

## The app

| Tab | What it does |
| --- | --- |
| Order | Type a request. The agent plans an order, and you place it or cancel it. |
| Orders | Every order the agent has proposed, and its status. |
| Runs | Every agent run, and each step it took: model calls and tool calls, with inputs and outputs. |
| Team | The office address, headcount, budget per person, and dietary notes. |

## The agent

The agent is a tool-calling loop in `src/agent.js`. It calls `nvidia/nemotron-3.5-super-vl:free` through OpenRouter until the model replies without calling a tool. Set `AGENT_MODEL` in `.env` to try another model.

Its tools are in `src/tools.js`:

| Tool | What it does |
| --- | --- |
| `get_user_context` | Looks up the office address, headcount, dietary notes, and recent orders. |
| `search_nearby_restaurants` | Finds restaurants by cuisine and distance. |
| `get_menu` | Fetches a restaurant's menu from the menu provider. |
| `check_catering_capacity` | Checks whether a restaurant can feed the headcount. |
| `get_reviews` | Gets a restaurant's rating. |
| `estimate_order` | Prices an order. |
| `check_delivery_eta` | Estimates when the food arrives. |
| `propose_order` | Saves the recommended order for the person to confirm. |

## Files

| Path | What's in it |
| --- | --- |
| `server.js` | HTTP server and API routes |
| `src/agent.js` | The agent loop and its system prompt |
| `src/tools.js` | The agent's tools |
| `src/db.js` | SQLite connection. Creates `app.db` from the schema and seed data if it's missing. |
| `db/schema.sql` | Tables: office, restaurants, menu items, runs, run steps, orders |
| `db/seed.sql` | Starting data |
| `public/` | The web app: `index.html`, `app.js`, `styles.css` |

## Running in a Codespace

The repo includes a dev container with Node 22, Claude Code, and Live Share.

1. In the repo, go to **Settings → Secrets and variables → Codespaces** and add an `OPENROUTER_API_KEY` secret for the app. The default model is free, but give the key a low spend limit anyway.
2. Click **Code → Codespaces → ⋯ → New with options** and pick a 4-core machine. In github.com/settings/codespaces, raise the default idle timeout to about 120 minutes.
3. Once it boots, run `claude` in a terminal and sign in with your Claude account. Then run `npm start` in a second terminal.
4. In the **Ports** tab, set port 3000 to **Public** and copy the URL.
5. Start Live Share from the status bar and share the invite link. Share both terminals as read/write.

Afterwards, delete the codespace at github.com/codespaces and revoke both keys.
