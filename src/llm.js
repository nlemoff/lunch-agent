import Anthropic from "@anthropic-ai/sdk";
import { toolDefinitions } from "./tools.js";

const PROVIDERS = {
  anthropic: { keyName: "ANTHROPIC_API_KEY", defaultModel: "claude-haiku-5-5", start: anthropicConversation },
  openai: { keyName: "OPENAI_API_KEY", defaultModel: "gpt-6-luna", start: openaiConversation },
};

// Uses AGENT_PROVIDER if set, otherwise the first provider whose API key is set.
export const PROVIDER =
  process.env.AGENT_PROVIDER ?? Object.keys(PROVIDERS).find((name) => process.env[PROVIDERS[name].keyName]);
export const MODEL = process.env.AGENT_MODEL ?? PROVIDERS[PROVIDER]?.defaultModel;

// A conversation holds the provider's own message history. next() asks the model for its next turn,
// and returns its text and tool calls as { id, name, args }, with args as a JSON string.
export function startConversation(system, request) {
  const { keyName, start } = PROVIDERS[PROVIDER];
  return start({ apiKey: process.env[keyName], system, request });
}

function anthropicConversation({ apiKey, system, request }) {
  const client = new Anthropic({ apiKey });
  const tools = toolDefinitions.map(({ function: f }) => ({ name: f.name, description: f.description, input_schema: f.parameters }));
  const messages = [{ role: "user", content: request }];

  return {
    async next() {
      const response = await client.messages.create({ model: MODEL, max_tokens: 16000, system, tools, messages });
      messages.push({ role: "assistant", content: response.content });
      return {
        text: response.content.filter((b) => b.type === "text").map((b) => b.text).join("\n") || null,
        calls: response.content
          .filter((b) => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, args: JSON.stringify(b.input) })),
      };
    },
    addResults(results) {
      messages.push({
        role: "user",
        content: results.map(({ id, output }) => ({ type: "tool_result", tool_use_id: id, content: output })),
      });
    },
  };
}

function openaiConversation({ apiKey, system, request }) {
  const messages = [
    { role: "system", content: system },
    { role: "user", content: request },
  ];

  return {
    async next() {
      const res = await fetch(`${process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        // gpt-6 models only accept tools on Chat Completions with reasoning off.
        body: JSON.stringify({ model: MODEL, messages, tools: toolDefinitions, reasoning_effort: "none" }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const message = (await res.json()).choices[0].message;
      messages.push(message);
      return {
        text: message.content,
        calls: (message.tool_calls ?? []).map((c) => ({ id: c.id, name: c.function.name, args: c.function.arguments })),
      };
    },
    addResults(results) {
      for (const { id, output } of results) messages.push({ role: "tool", tool_call_id: id, content: output });
    },
  };
}
