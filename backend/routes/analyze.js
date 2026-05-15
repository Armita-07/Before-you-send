const express = require("express");
const { analyzeEmail } = require("../lib/gemini");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

/**
 * POST /analyze
 * Analyzes email content using Claude and stores results in Supabase.
 *
 * Request body: { subject: string, body: string, userId: string }
 * Response: { verdict, reason, flags, analysisId }
 */
router.post("/", async (req, res) => {
  const { subject, body, userId } = req.body;

  if (!body || typeof body !== "string") {
    return res.status(400).json({ error: "Email body is required" });
  }

  try {
    // Call Claude for analysis
    const result = await analyzeEmail(subject || "(no subject)", body);

    // Save to Supabase
    let analysisId = null;
    try {
      const { data, error } = await supabase
        .from("analyses")
        .insert({
          user_id: userId || "anonymous",
          subject: subject || "(no subject)",
          verdict: result.verdict,
          reason: result.reason,
          flags: result.flags,
          sent_anyway: false,
        })
        .select("id")
        .single();

      if (!error && data) {
        analysisId = data.id;
      } else if (error) {
        console.error("Supabase insert error:", error.message);
      }
    } catch (dbErr) {
      console.error("Supabase connection error:", dbErr.message);
      // Don't fail the request if DB is down
    }

    return res.json({
      verdict: result.verdict,
      reason: result.reason,
      flags: result.flags,
      analysisId,
    });
  } catch (err) {
    console.error("Analysis error:", err.message);
    return res.status(500).json({
      error: "Analysis failed",
      // Fail open: return amber so the user can still send
      verdict: "amber",
      reason: "Couldn't complete analysis — review before sending.",
      flags: [],
    });
  }
});

/**
 * PATCH /analyze/:id/sent
 * Marks an analysis as "sent anyway"
 */
router.patch("/:id/sent", async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase
      .from("analyses")
      .update({ sent_anyway: true })
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /analyze/history/:userId
 * Returns the last 5 analyses and stats for a user
 */
router.get("/history/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    // Get last 5 analyses
    const { data: recent, error: recentErr } = await supabase
      .from("analyses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    if (recentErr) {
      return res.status(500).json({ error: recentErr.message });
    }

    // Get stats
    const { count: totalCount } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: sentAnywayCount } = await supabase
      .from("analyses")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("sent_anyway", true);

    return res.json({
      recent: recent || [],
      stats: {
        totalChecked: totalCount || 0,
        sentAnyway: sentAnywayCount || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
