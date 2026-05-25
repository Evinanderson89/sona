import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./routes.js";
import { BudgetExceededError, BUDGET_CAP_USD } from "./budget.js";

app.onError((err, c) => {
  if (err instanceof BudgetExceededError) {
    return c.json(
      {
        error: err.message,
        code: "BUDGET_EXCEEDED",
        budget: err.status,
      },
      402,
    );
  }
  console.error("Unhandled error:", err);
  return c.json({ error: err.message }, 500);
});

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(
    `Sona API listening on http://localhost:${info.port} (cap $${BUDGET_CAP_USD.toFixed(2)})`,
  );
});
