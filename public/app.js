const $ = (selector) => document.querySelector(selector);

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

const money = (n) => `$${Number(n).toFixed(2)}`;

// Builds an element from a tag, attributes, and children. Strings become text, so user data is never parsed as HTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value);
  }
  el.append(...children.flat().filter((c) => c != null).map((c) => (c instanceof Node ? c : String(c))));
  return el;
}

// Order tab

function orderCard(order) {
  const actions =
    order.status === "proposed"
      ? h(
          "div",
          { class: "actions" },
          h("button", { class: "primary", onclick: () => updateOrder(order, "place") }, "Place order"),
          h("button", { onclick: () => updateOrder(order, "cancel") }, "Cancel"),
        )
      : h("p", { class: `status ${order.status}` }, order.status === "placed" ? "Order placed" : "Order cancelled");

  return h(
    "div",
    { class: "order-card" },
    h("h2", {}, order.restaurant_name),
    h(
      "table",
      {},
      h("tbody", {}, order.items.map((item) => h("tr", {}, h("td", {}, `${item.quantity} ×`), h("td", {}, item.name), h("td", {}, money(item.price * item.quantity))))),
    ),
    h("p", { class: "total" }, `Total ${money(order.total)} · arrives around ${order.eta}`),
    actions,
  );
}

async function updateOrder(order, action) {
  const updated = await api(`/api/orders/${order.id}/${action}`, { method: "POST" });
  $("#result .order-card").replaceWith(orderCard(updated));
}

$("#request-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const request = $("#request").value.trim();
  if (!request) return;
  const button = $("#request-form button");
  button.disabled = true;
  $("#result").replaceChildren(h("p", { class: "muted" }, "The agent is working. This can take up to a minute."));
  try {
    const { run, order } = await api("/api/runs", { method: "POST", body: { request } });
    $("#result").replaceChildren(
      run.status === "failed"
        ? h("p", { class: "error" }, `The agent failed: ${run.error}`)
        : h("p", { class: "agent-message" }, run.final_message),
      order && orderCard(order),
    );
  } catch (err) {
    $("#result").replaceChildren(h("p", { class: "error" }, err.message));
  }
  button.disabled = false;
});

// Orders tab

async function showOrders() {
  const orders = await api("/api/orders");
  $("#orders-body").replaceChildren(
    ...orders.map((o) =>
      h("tr", {}, h("td", {}, o.id), h("td", {}, o.created_at), h("td", {}, o.restaurant_name), h("td", {}, money(o.total)), h("td", {}, o.eta), h("td", {}, h("span", { class: `status ${o.status}` }, o.status))),
    ),
  );
}

// Runs tab

async function showRunDetail(id) {
  const { run, steps } = await api(`/api/runs/${id}`);
  $("#run-detail").replaceChildren(
    h("h2", {}, `Run ${run.id}: ${run.request}`),
    h("p", { class: "muted" }, `${run.model} · ${run.status}`),
    h(
      "ol",
      { class: "steps" },
      steps.map((s) =>
        h(
          "li",
          { class: `step ${s.kind}${s.error ? " has-error" : ""}` },
          h("div", { class: "step-head" }, h("b", {}, s.name), h("span", { class: "muted" }, `${s.kind} · ${s.duration_ms} ms`)),
          s.input && h("pre", {}, s.input),
          h("pre", {}, s.error ?? s.output),
        ),
      ),
    ),
    run.final_message && h("p", { class: "agent-message" }, run.final_message),
  );
}

async function showRuns() {
  const runs = await api("/api/runs");
  $("#runs-body").replaceChildren(
    ...runs.map((r) =>
      h(
        "tr",
        { class: "clickable", onclick: () => showRunDetail(r.id) },
        h("td", {}, r.id),
        h("td", {}, r.request),
        h("td", {}, r.status),
        h("td", {}, r.step_count),
        h("td", {}, r.error_count ?? 0),
        h("td", {}, r.started_at),
      ),
    ),
  );
  $("#run-detail").replaceChildren();
}

// Team tab

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
});

// Tabs

const loaders = { orders: showOrders, runs: showRuns, team: showTeam };

function showTab() {
  const tab = location.hash.slice(1) || "order";
  for (const section of document.querySelectorAll(".tab")) section.hidden = section.id !== tab;
  for (const link of document.querySelectorAll("nav a")) link.classList.toggle("active", link.hash === `#${tab}`);
  loaders[tab]?.();
}

window.addEventListener("hashchange", showTab);
showTab();
