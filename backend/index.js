require("dotenv").config();

const express = require("express");
const cors = require("cors");
const analyzeRouter = require("./routes/analyze");

const app = express();
const PORT = process.env.PORT || 3001;

// CORS — allow Chrome extension origins and localhost
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., curl, Postman)
      if (!origin) return callback(null, true);
      // Allow Chrome extension origins
      if (origin.startsWith("chrome-extension://")) return callback(null, true);
      // Allow localhost for development
      if (origin.includes("localhost") || origin.includes("127.0.0.1"))
        return callback(null, true);
      callback(null, true); // permissive for dev; tighten in production
    },
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Root route to avoid "Cannot GET /"
app.get("/", (req, res) => {
  res.json({ message: "Before You Send API is running!" });
});

// Routes
app.use("/analyze", analyzeRouter);

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`✓ Before You Send backend running on http://localhost:${PORT}`);
    console.log(`  POST /analyze — analyze email content`);
    console.log(`  GET  /analyze/history/:userId — get analysis history`);
    console.log(`  GET  /health — health check`);
  });
}

module.exports = app;
