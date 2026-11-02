# Platter

Platter runs a lunch-ordering agent for companies. Each company gets its own workspace with its office, headcount, budget, and dietary notes. This repo is the agent and app for one workspace, Fieldnote HQ.

Someone types a request like "order me mediterranean food to feed 30 hungry engineers". The agent finds restaurants nearby, checks menus and catering capacity, prices the order, and asks the person to confirm before it's placed.

## Run it

You need Node 22.13 or later.

```bash
npm install
cp .env.example .env
```

Paste an Anthropic or OpenAI API key into `.env`, then start the app:

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
| New order | Type a request and watch the agent work. It proposes an order, and you place it or cancel it. |
| Orders | Every order the agent has proposed, its status, and a link to the run behind it. |
| Runs | Every agent run, and each step it took: model calls and tool calls, with inputs and outputs. |
| Team | The office's name, address, headcount, budget per person, and dietary notes. |

## The agent

The agent is a tool-calling loop in `src/agent.js`. It calls the model until the model replies without calling a tool. `src/llm.js` picks the provider from the key in `.env`:

| Key | Default model |
| --- | --- |
| `ANTHROPIC_API_KEY` | `claude-haiku-5-5` |
| `OPENAI_API_KEY` | `gpt-6-luna` |

If both keys are set, the app uses Anthropic. Set `AGENT_PROVIDER=openai` to use OpenAI instead, or `AGENT_MODEL` to try another model.

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
| `src/llm.js` | Calls Anthropic or OpenAI, depending on which key is set |
| `src/tools.js` | The agent's tools |
| `src/db.js` | SQLite connection. Creates `app.db` from the schema and seed data if it's missing. |
| `db/schema.sql` | Tables: office, restaurants, menu items, runs, run steps, orders |
| `db/seed.sql` | Starting data |
| `public/` | The web app: `index.html`, `app.js`, `styles.css` |

## Running in a Codespace

The repo includes a dev container with Node 22, Claude Code, and Live Share.

1. In the repo, go to **Settings → Secrets and variables → Codespaces** and add an `OPENAI_API_KEY` secret for the app, with a low spend limit. Codespace terminals clear `ANTHROPIC_API_KEY` so Claude Code uses the signed-in account, so an Anthropic key won't reach the app there.
2. Click **Code → Codespaces → ⋯ → New with options** and pick a 4-core machine. In github.com/settings/codespaces, raise the default idle timeout to about 120 minutes.
3. Once it boots, run `claude` in a terminal and sign in with your Claude account. Then run `npm start` in a second terminal.
4. In the **Ports** tab, set port 3000 to **Public** and copy the URL.
5. Start Live Share from the status bar and share the invite link. Share both terminals as read/write.

Afterwards, run `/logout` in Claude Code, delete the codespace at github.com/codespaces, and revoke the OpenAI key.
