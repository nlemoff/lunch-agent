const $ = (selector) => document.querySelector(selector);
const OFFICE_TIME_ZONE = "America/Los_Angeles";

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json" },
    body: options.body && JSON.stringify(options.body),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

// Builds an element from a tag, attributes, and children. Strings become text, so data is never parsed as HTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false).map((c) => (c instanceof Node ? c : String(c))));
  return el;
}

const money = (n) => Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });

// SQLite stores UTC as "YYYY-MM-DD HH:MM:SS"; show it in the office's time zone.
function when(sqlTime) {
  return new Date(`${sqlTime.replace(" ", "T")}Z`).toLocaleString("en-US", {
    timeZone: OFFICE_TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const duration = (ms) => (ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`);

const TAG_LABELS = { vegetarian: "Vegetarian", vegan: "Vegan", "gluten-free": "Gluten-free" };
const tagBadges = (tags = "") => tags.split(",").filter(Boolean).map((t) => h("span", { class: "badge" }, TAG_LABELS[t] ?? t));

const STATUS_BADGES = {
  proposed: h("span", { class: "badge warning" }, "Waiting for you"),
  placed: h("span", { class: "badge success" }, "Placed"),
  cancelled: h("span", { class: "badge" }, "Cancelled"),
};
const statusBadge = (status) => STATUS_BADGES[status].cloneNode(true);

let restaurants = {};

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// One plain sentence for each tool call, shown while the agent works.
function describeStep(step) {
  const input = parseJson(step.input);
  const name = restaurants[input.restaurant_id]?.name;
  const labels = {
    get_user_context: "Read the office details",
    search_nearby_restaurants: `Searched for ${input.cuisine ?? ""} restaurants nearby`,
    get_menu: `Read ${name}'s menu`,
    check_catering_capacity: `Checked ${name} can feed ${input.headcount}`,
    get_reviews: `Read ${name}'s reviews`,
    estimate_order: "Priced the order",
    check_delivery_eta: `Estimated delivery from ${name}`,
    propose_order: "Saved the order for you to review",
  };
  const label = labels[step.name] ?? step.name;
  return step.error ? `${label} failed: ${step.error}` : label;
}

// New order

const EXAMPLES = [
  "Mediterranean for the whole team",
  "Vegetarian lunch for 12 under $200",
  "Tacos for Friday's all-hands",
];

function progressPanel(run, steps) {
  const toolSteps = steps.filter((s) => s.kind === "tool");
  const working = run.status === "running";
  return h(
    "section",
    { class: "panel progress" },
    h("h2", {}, working ? "Planning your order" : "What the agent did"),
    h(
      "ul",
      { class: "steps" },
      toolSteps.map((s) =>
        h(
          "li",
          { class: `step-line${s.error ? " failed" : ""}` },
          h("span", { class: `dot ${s.error ? "failed" : "done"}` }),
          h("span", { class: "label" }, describeStep(s)),
        ),
      ),
      working && h("li", { class: "step-line" }, h("span", { class: "dot running" }), h("span", { class: "label muted" }, "Thinking")),
    ),
  );
}

function proposal(order, runId) {
  const subtotal = order.items.reduce((sum, i) => sum + i.quantity * i.price, 0);
  const actions =
    order.status === "proposed"
      ? h(
          "div",
          { class: "actions" },
          h("button", { class: "button ghost", onclick: () => updateOrder(order, "cancel", runId) }, "Cancel"),
          h("button", { class: "button primary", onclick: () => updateOrder(order, "place", runId) }, "Place order"),
        )
      : statusBadge(order.status);

  return h(
    "section",
    { class: "panel" },
    h(
      "div",
      { class: "proposal-head" },
      h(
        "div",
        {},
        h("h2", {}, order.restaurant_name),
        h("p", { class: "muted" }, `${order.distance_miles} mi away · ${order.rating} stars from ${order.review_count.toLocaleString()} reviews`),
      ),
      h("a", { class: "link", href: `#runs/${runId}` }, "View run"),
    ),
    h(
      "table",
      { class: "items" },
      h(
        "tbody",
        {},
        order.items.map((item) =>
          h(
            "tr",
            {},
            h("td", { class: "qty num" }, `${item.quantity}×`),
            h("td", {}, h("div", { class: "item-name" }, item.name, tagBadges(item.tags))),
            h("td", { class: "serves" }, item.serves > 1 ? `serves ${item.serves} each` : ""),
            h("td", { class: "num" }, money(item.price * item.quantity)),
          ),
        ),
      ),
    ),
    h(
      "div",
      { class: "totals" },
      h("div", {}, h("span", {}, "Subtotal"), h("span", { class: "num" }, money(subtotal))),
      h("div", {}, h("span", {}, "Delivery"), h("span", { class: "num" }, money(order.total - subtotal))),
      h("div", { class: "total" }, h("span", {}, "Total"), h("span", { class: "num" }, money(order.total))),
    ),
    h(
      "div",
      { class: "proposal-foot" },
      h("span", { class: "muted" }, `Arrives around ${order.eta}`),
      actions,
    ),
  );
}

async function updateOrder(order, action, runId) {
  await api(`/api/orders/${order.id}/${action}`, { method: "POST" });
  await showRunResult(runId);
  loadRecentOrders();
}

async function showRunResult(runId) {
  const { run, steps, order } = await api(`/api/runs/${runId}`);
  const blocks = [
    progressPanel(run, steps),
    run.status === "failed" && h("section", { class: "panel error-box" }, `The agent stopped: ${run.error}`),
    run.final_message && h("section", { class: "panel agent-message" }, run.final_message),
    order && proposal(order, runId),
  ];
  $("#run-area").replaceChildren(...blocks.filter(Boolean));
  return run.status;
}

async function watchRun(runId) {
  while ((await showRunResult(runId)) === "running") {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

$("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = $("#request").value.trim();
  if (!request) return;
  const button = $("#plan-button");
  button.disabled = true;
  try {
    const { runId } = await api("/api/runs", { method: "POST", body: { request } });
    await watchRun(runId);
  } catch (err) {
    $("#run-area").replaceChildren(h("section", { class: "panel error-box" }, err.message));
  }
  button.disabled = false;
});

$("#request").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) $("#request-form").requestSubmit();
});

$("#examples").replaceChildren(
  ...EXAMPLES.map((text) =>
    h("button", { type: "button", class: "button", onclick: () => { $("#request").value = text; $("#request").focus(); } }, text),
  ),
);

async function loadOffice() {
  const office = await api("/api/office");
  $("#scope").textContent = office.name;
  $("#office-line").textContent = `For ${office.name} · ${office.headcount} people · ${office.address}`;
  $("#office-facts").replaceChildren(
    h("dt", {}, "Headcount"), h("dd", {}, office.headcount),
    h("dt", {}, "Address"), h("dd", {}, office.address),
    h("dt", {}, "Dietary"), h("dd", {}, office.dietary_notes || "None noted"),
  );
}

async function loadRecentOrders() {
  const placed = (await api("/api/orders")).filter((o) => o.status === "placed").slice(0, 3);
  $("#recent-orders").replaceChildren(
    ...(placed.length
      ? placed.map((o) =>
          h("li", {}, h("div", {}, h("div", {}, o.restaurant_name), h("div", { class: "sub" }, when(o.created_at))), h("span", { class: "num" }, money(o.total))),
        )
      : [h("li", { class: "muted" }, "No orders placed yet.")]),
  );
}

// Orders

async function showOrders() {
  const orders = await api("/api/orders");
  const placed = orders.filter((o) => o.status === "placed");
  $("#orders-line").textContent = `${placed.length} placed · ${money(placed.reduce((sum, o) => sum + o.total, 0))} spent`;
  $("#orders-body").replaceChildren(
    ...orders.map((o) =>
      h(
        "tr",
        {},
        h("td", { class: "mono" }, `#${o.id}`),
        h("td", {}, when(o.created_at)),
        h("td", {}, o.restaurant_name),
        h("td", { class: "num" }, o.items.reduce((sum, i) => sum + i.quantity, 0)),
        h("td", { class: "num" }, money(o.total)),
        h("td", {}, o.eta),
        h("td", {}, statusBadge(o.status)),
        h("td", { class: "num" }, o.run_id && h("a", { class: "link", href: `#runs/${o.run_id}` }, "View run")),
      ),
    ),
  );
}

// Runs

async function showRuns(selectedId) {
  const runs = await api("/api/runs");
  const id = selectedId ?? runs[0]?.id;
  $("#run-list").replaceChildren(
    ...runs.map((r) =>
      h(
        "li",
        {},
        h(
          "a",
          { href: `#runs/${r.id}`, class: r.id === id ? "active" : null },
          h("span", { class: `dot ${r.status === "failed" ? "failed" : r.status === "running" ? "running" : "done"}` }),
          h(
            "div",
            { style: "min-width: 0" },
            h("div", { class: "request" }, r.request),
            h("div", { class: "sub" }, `${when(r.started_at)} · ${r.step_count} steps${r.error_count ? ` · ${r.error_count} failed` : ""}`),
          ),
        ),
      ),
    ),
  );
  if (id) showRunDetail(id);
  else $("#run-detail").replaceChildren(h("p", { class: "muted" }, "No runs yet. Plan an order to see the agent's steps here."));
}

async function showRunDetail(id) {
  const { run, steps } = await api(`/api/runs/${id}`);
  const pretty = (text) => {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  };
  $("#run-detail").replaceChildren(
    h(
      "div",
      { class: "run-head" },
      h("div", {}, h("h2", {}, run.request), h("p", { class: "muted" }, `${when(run.started_at)} · `, h("span", { class: "mono" }, run.model))),
      h("span", { class: `badge ${run.status === "failed" ? "destructive" : run.status === "done" ? "success" : "warning"}` }, run.status),
    ),
    h(
      "ol",
      { class: "trace" },
      steps.map((s) =>
        h(
          "li",
          {},
          h(
            "details",
            {},
            h(
              "summary",
              {},
              h("span", { class: "badge" }, s.kind === "llm" ? "Model" : "Tool"),
              h("span", { class: "name" }, s.kind === "llm" ? "chat completion" : s.name),
              s.error && h("span", { class: "badge destructive" }, "Error"),
              h("span", { class: "mono" }, duration(s.duration_ms)),
            ),
            h(
              "div",
              { class: "io" },
              s.input && [h("div", { class: "io-label" }, "Input"), h("pre", {}, pretty(s.input))],
              h("div", { class: "io-label" }, s.error ? "Error" : "Output"),
              h("pre", {}, s.error ?? pretty(s.output)),
            ),
          ),
        ),
      ),
    ),
    run.final_message && h("div", { class: "final" }, h("div", { class: "io-label muted" }, "Final reply"), h("p", {}, run.final_message)),
  );
}

// Team

async function showTeam() {
  const office = await api("/api/office");
  for (const field of $("#team-form").elements) {
    if (field.name) field.value = office[field.name] ?? "";
  }
  $("#team-saved").textContent = "";
}

$("#team-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target));
  await api("/api/office", {
    method: "PUT",
    body: { ...form, headcount: Number(form.headcount), budget_per_person: form.budget_per_person ? Number(form.budget_per_person) : null },
  });
  $("#team-saved").textContent = "Saved";
  loadOffice();
});

// Routing

function route() {
  const [view, id] = (location.hash.slice(1) || "new").split("/");
  for (const section of document.querySelectorAll(".view")) section.hidden = section.id !== `view-${view}`;
  for (const link of document.querySelectorAll("nav a")) link.classList.toggle("active", link.hash === `#${view}`);
  if (view === "new") loadRecentOrders();
  if (view === "orders") showOrders();
  if (view === "runs") showRuns(id && Number(id));
  if (view === "team") showTeam();
}

restaurants = Object.fromEntries((await api("/api/restaurants")).map((r) => [r.id, r]));
window.addEventListener("hashchange", route);
loadOffice();
route();
