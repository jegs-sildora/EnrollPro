import "dotenv/config";
import path from "path";

// Ecosystem Integration: Environment variables updated on 2026-05-13
process.env.TZ = "Asia/Manila";

import app from "./app.js";

const __dirname = path.resolve();
import express from "express";

// 1. Serve static frontend assets
app.use(express.static(path.join(__dirname, "../client/dist")));

// 2. The PROTECTED Catch-All: 
// Serve the React App for any route EXCEPT those starting with "/api"
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "../client/dist", "index.html"));
});

// 3. Optional but highly recommended: Catch unmatched /api routes and return a proper JSON 404
app.all("/api/", (req, res) => {
  res.status(404).json({ error: "API endpoint not found" });
});
// -----------------------------------------------

const PORT = process.env.PORT || 5002;

app.listen(PORT as number, "0.0.0.0", () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
});