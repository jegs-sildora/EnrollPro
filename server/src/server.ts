import "dotenv/config";

// Set process timezone to Manila
process.env.TZ = "Asia/Manila";

import app from "./app.js";

const PORT = process.env.PORT || 5000;

app.listen(PORT as number, "0.0.0.0", () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});
