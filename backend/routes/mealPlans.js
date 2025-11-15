// backend/routes/mealPlans.js
const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/database"); // ✅ correct path

// helper: get userId safely
function getUserId(req) {
  // if you have auth:
  // return req.session?.userId;
  // TEMP: hardcode 1 during dev
  return req.session?.userId || 1;
}

/**
 * GET /api/meal-plans
 * Query: start=YYYY-MM-DD, end=YYYY-MM-DD
 * Returns all plans for the user in that date range
 */
router.get("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "start and end are required" });
    }

    const [rows] = await sequelize.query(
      `
      SELECT meal_date, goals_json, plan_json
      FROM meal_plans
      WHERE user_id = ?
        AND meal_date BETWEEN ? AND ?
      ORDER BY meal_date ASC
    `,
      {
        replacements: [userId, start, end],
      }
    );

    const result = rows.map((row) => ({
      date: row.meal_date,
      goals: row.goals_json ? JSON.parse(row.goals_json) : [],
      plan: row.plan_json ? JSON.parse(row.plan_json) : {},
    }));

    res.json(result);
  } catch (err) {
    console.error("GET /api/meal-plans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/meal-plans
 * Body: { mealDate: "YYYY-MM-DD", goals: [...], plan: {...} }
 * Upsert by (user_id, meal_date)
 */
router.post("/", async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { mealDate, goals, plan } = req.body;

    if (!mealDate || !plan) {
      return res
        .status(400)
        .json({ error: "mealDate and plan are required" });
    }

    const goalsJson = JSON.stringify(goals || []);
    const planJson = JSON.stringify(plan || {});

    await sequelize.query(
      `
      INSERT INTO meal_plans (user_id, meal_date, goals_json, plan_json)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        goals_json = VALUES(goals_json),
        plan_json = VALUES(plan_json),
        updated_at = CURRENT_TIMESTAMP
    `,
      {
        replacements: [userId, mealDate, goalsJson, planJson],
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("POST /api/meal-plans error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
