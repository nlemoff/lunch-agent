import { db } from "./db.js";

const DELIVERY_FEE = 15;

// Cedar Grill's menu provider is down. The agent sees the same error a real third-party API would return.
const MENU_PROVIDER_DOWN = new Set(["cedar-grill"]);

function restaurant(id) {
  const row = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(id);
  if (!row) throw new Error(`No restaurant with id "${id}"`);
  return row;
}

function priceOrder(restaurantId, items) {
  const lines = items.map(({ item_id, quantity }) => {
    const item = db.prepare("SELECT * FROM menu_items WHERE id = ? AND restaurant_id = ?").get(item_id, restaurantId);
    if (!item) throw new Error(`No menu item "${item_id}" at ${restaurantId}`);
    return { item_id, name: item.name, quantity, price: item.price, serves: item.serves };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
  return { lines, subtotal, delivery_fee: DELIVERY_FEE, total: subtotal + DELIVERY_FEE };
}

function deliveryEta(r) {
  const minutes = r.prep_minutes + Math.round(r.distance_miles * 10);
  const eta = new Date(Date.now() + minutes * 60_000);
  return eta.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

const itemsSchema = {
  type: "array",
  items: {
    type: "object",
    properties: { item_id: { type: "string" }, quantity: { type: "integer", minimum: 1 } },
    required: ["item_id", "quantity"],
  },
};

// Each tool has the description the model sees and the function that runs it.
export const tools = {
  get_user_context: {
    description: "Look up the office address, headcount, dietary notes, and recent orders.",
    parameters: { type: "object", properties: {} },
    run() {
      const office = db.prepare("SELECT name, address, headcount, dietary_notes FROM office WHERE id = 1").get();
      const recent = db
        .prepare(
          `SELECT r.name AS restaurant, o.total, o.created_at FROM orders o
           JOIN restaurants r ON r.id = o.restaurant_id WHERE o.status = 'placed'
           ORDER BY o.created_at DESC LIMIT 3`,
        )
        .all();
      return { ...office, recent_orders: recent };
    },
  },

  search_nearby_restaurants: {
    description: "Find restaurants near the office by cuisine, closest first.",
    parameters: {
      type: "object",
      properties: {
        cuisine: { type: "string", description: "For example mediterranean, mexican, thai, indian, sandwiches, japanese" },
        max_distance_miles: { type: "number" },
      },
      required: ["cuisine"],
    },
    run({ cuisine, max_distance_miles = 2 }) {
      return db
        .prepare(
          "SELECT id, name, cuisine, distance_miles FROM restaurants WHERE cuisine = ? AND distance_miles <= ? ORDER BY distance_miles",
        )
        .all(cuisine.toLowerCase(), max_distance_miles);
    },
  },

  get_menu: {
    description: "Fetch a restaurant's menu from the menu provider.",
    parameters: { type: "object", properties: { restaurant_id: { type: "string" } }, required: ["restaurant_id"] },
    run({ restaurant_id }) {
      restaurant(restaurant_id);
      if (MENU_PROVIDER_DOWN.has(restaurant_id)) throw new Error("504 Gateway Timeout from menu provider");
      return db.prepare("SELECT id, name, price, serves, tags FROM menu_items WHERE restaurant_id = ?").all(restaurant_id);
    },
  },

  check_catering_capacity: {
    description: "Check whether a restaurant can cater for a given headcount.",
    parameters: {
      type: "object",
      properties: { restaurant_id: { type: "string" }, headcount: { type: "integer" } },
      required: ["restaurant_id", "headcount"],
    },
    run({ restaurant_id, headcount }) {
      const r = restaurant(restaurant_id);
      return { can_cater: headcount <= r.catering_max, max_headcount: r.catering_max };
    },
  },

  get_reviews: {
    description: "Get a restaurant's rating and review count.",
    parameters: { type: "object", properties: { restaurant_id: { type: "string" } }, required: ["restaurant_id"] },
    run({ restaurant_id }) {
      const { rating, review_count } = restaurant(restaurant_id);
      return { rating, review_count };
    },
  },

  estimate_order: {
    description: "Price an order. Returns each line, the subtotal, the delivery fee, and the total.",
    parameters: {
      type: "object",
      properties: { restaurant_id: { type: "string" }, items: itemsSchema },
      required: ["restaurant_id", "items"],
    },
    run({ restaurant_id, items }) {
      return priceOrder(restaurant_id, items);
    },
  },

  check_delivery_eta: {
    description: "Estimate when an order from a restaurant would arrive if placed now.",
    parameters: { type: "object", properties: { restaurant_id: { type: "string" } }, required: ["restaurant_id"] },
    run({ restaurant_id }) {
      return { eta: deliveryEta(restaurant(restaurant_id)) };
    },
  },

  propose_order: {
    description: "Save the order you recommend so the user can confirm it. Call this once, at the end.",
    parameters: {
      type: "object",
      properties: { restaurant_id: { type: "string" }, items: itemsSchema },
      required: ["restaurant_id", "items"],
    },
    run({ restaurant_id, items }, { runId }) {
      const { lines, total } = priceOrder(restaurant_id, items);
      const eta = deliveryEta(restaurant(restaurant_id));
      const { lastInsertRowid } = db
        .prepare("INSERT INTO orders (run_id, restaurant_id, items, total, eta, status) VALUES (?, ?, ?, ?, ?, 'proposed')")
        .run(runId, restaurant_id, JSON.stringify(lines), total, eta);
      return { order_id: Number(lastInsertRowid), total, eta };
    },
  },
};

export const toolDefinitions = Object.entries(tools).map(([name, { description, parameters }]) => ({
  type: "function",
  function: { name, description, parameters },
}));
