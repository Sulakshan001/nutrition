// backend/server.js
require("dotenv").config();

const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const passport = require("passport");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const { sequelize } = require("./config/database");
const authRoutes = require("./routes/auth");
const dataRoutes = require("./routes/data");
const mealPlanRoutes = require("./routes/mealPlans");
const { initializePassport } = require("./controllers/authController");

const app = express();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const PORT = process.env.PORT || 4000;

// ---------- MIDDLEWARE ----------
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_session_key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set true only behind HTTPS
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

initializePassport(passport);
app.use(passport.initialize());
app.use(passport.session());

// DEBUG MIDDLEWARE
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// ---------- ROUTES ----------

// health check
app.get("/api/ping", (req, res) => res.json({ ok: true, time: new Date() }));

// Auth routes
app.use("/api/auth", authRoutes);

// Data routes
app.use("/api/data", dataRoutes);

// Meal plan routes
app.use("/api/meal-plans", mealPlanRoutes);

// (If your Google auth is not inside authRoutes, you can keep these. Otherwise remove them to avoid duplication.)
app.get(
  "/api/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/api/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login-failed",
    session: true,
  }),
  (req, res) => {
    res.redirect(`${FRONTEND_URL}/`);
  }
);

// ---------- STATIC FRONTEND (optional) ----------
const frontendBuild = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(frontendBuild)) {
  app.use(express.static(frontendBuild));
  app.get("*", (req, res) => {
    res.sendFile(path.join(frontendBuild, "index.html"));
  });
}

// ---------- ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error("🔥 Unhandled error:", err);
  res
    .status(500)
    .json({ message: "Internal Server Error", error: err.message });
});

// ---------- START SERVER ----------
app.listen(PORT, async () => {
  console.log(`✅ Backend listening on http://localhost:${PORT}`);
  try {
    await sequelize.authenticate();
    console.log("✅ Database connected.");
  } catch (err) {
    console.error("❌ DB connection error:", err.message);
  }
});
