import { db } from "./db.js";
import { tools } from "./tools.js";
import { MODEL, startConversation } from "./llm.js";

const MAX_TURNS = 15;

const SYSTEM_PROMPT = `You are a lunch-ordering agent for an office. Someone on the team tells you what they want, and you plan the order.

1. Look up the office context.
2. Find nearby restaurants for the cuisine they asked for.
3. Check menus, catering capacity, and reviews, and pick the best restaurant.
4. Choose items so everyone is fed, and price the order.
5. Call propose_order with your final choice.

Then reply in two or three plain sentences, with no markdown: the restaurant, what you're ordering, the total, and the delivery time.`;

function recordStep(runId, kind, name, input, output, error, startedAt) {
  db.prepare(
    "INSERT INTO run_steps (run_id, kind, name, input, output, error, duration_ms) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(runId, kind, name, input, output, error, Date.now() - startedAt);
}

async function runTool(runId, call) {
  const startedAt = Date.now();
  const { name, args: rawArgs } = call;
  try {
    const tool = tools[name];
    if (!tool) throw new Error(`Unknown tool "${name}"`);
    const output = JSON.stringify(tool.run(JSON.parse(rawArgs || "{}"), { runId }));
    recordStep(runId, "tool", name, rawArgs, output, null, startedAt);
    return output;
  } catch (err) {
    recordStep(runId, "tool", name, rawArgs, null, err.message, startedAt);
    return JSON.stringify({ error: err.message });
  }
}

// Starts a run and returns its id right away. The agent keeps working in the background and saves every step to run_steps.
export function startAgent(request) {
  const runId = Number(db.prepare("INSERT INTO runs (request, status, model) VALUES (?, 'running', ?)").run(request, MODEL).lastInsertRowid);
  runAgent(runId, request);
  return runId;
}

async function runAgent(runId, request) {
  const conversation = startConversation(SYSTEM_PROMPT, request);

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const startedAt = Date.now();
      const { text, calls } = await conversation.next();
      recordStep(
        runId,
        "llm",
        MODEL,
        null,
        JSON.stringify({ content: text, tool_calls: calls.map((c) => c.name) }),
        null,
        startedAt,
      );

      if (calls.length === 0) {
        db.prepare("UPDATE runs SET status = 'done', final_message = ?, finished_at = datetime('now') WHERE id = ?").run(
          text,
          runId,
        );
        return;
      }
      const results = [];
      for (const call of calls) results.push({ id: call.id, output: await runTool(runId, call) });
      conversation.addResults(results);
    }
    throw new Error(`Stopped after ${MAX_TURNS} turns without an answer`);
  } catch (err) {
    db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?").run(err.message, runId);
  }
}
