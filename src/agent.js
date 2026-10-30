import { db } from "./db.js";
import { tools, toolDefinitions } from "./tools.js";

const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";
export const MODEL = process.env.AGENT_MODEL ?? "nvidia/nemotron-3.5-super-vl:free";
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

async function chat(messages) {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "Platter",
    },
    body: JSON.stringify({ model: MODEL, messages, tools: toolDefinitions }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.json();
  return body.choices[0].message;
}

async function runTool(runId, call) {
  const startedAt = Date.now();
  const { name, arguments: rawArgs } = call.function;
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
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: request },
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const startedAt = Date.now();
      const message = await chat(messages);
      const calls = message.tool_calls ?? [];
      recordStep(
        runId,
        "llm",
        MODEL,
        null,
        JSON.stringify({ content: message.content, tool_calls: calls.map((c) => c.function.name) }),
        null,
        startedAt,
      );
      messages.push(message);

      if (calls.length === 0) {
        db.prepare("UPDATE runs SET status = 'done', final_message = ?, finished_at = datetime('now') WHERE id = ?").run(
          message.content,
          runId,
        );
        return;
      }
      for (const call of calls) {
        messages.push({ role: "tool", tool_call_id: call.id, content: await runTool(runId, call) });
      }
    }
    throw new Error(`Stopped after ${MAX_TURNS} turns without an answer`);
  } catch (err) {
    db.prepare("UPDATE runs SET status = 'failed', error = ?, finished_at = datetime('now') WHERE id = ?").run(err.message, runId);
  }
}
