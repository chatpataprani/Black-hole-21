/**
 * server/adminRoutes.js
 *
 * Admin-only broadcast API. Mounted in server.js under /api/admin and
 * /api/push. Every admin-only route requires a server-side secret —
 * there is no client-side "isAdmin" flag anywhere, by design (a client
 * flag is trivially forgeable; a bearer token checked in this file is
 * not).
 *
 * SETUP REQUIRED:
 *   Set ADMIN_TOKEN in your environment (Render → Environment) to a
 *   long random string. Without it, every admin route refuses to run
 *   at all (rather than falling back to some default password).
 *
 * This file works today for token registration and auth-gating. The
 * actual "send to Firebase" step depends on server/pushService.js being
 * configured — see that file's header comment for what's still needed.
 */

const express = require("express");
const push = require("./pushService");

const router = express.Router();

const MAX_TITLE_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 200;
const BROADCAST_COOLDOWN_MS = 30_000; // simple single-admin rate limit
let lastBroadcastAt = 0;

function requireAdmin(req, res, next) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    return res.status(503).json({
      error: "Admin access is not configured. Set ADMIN_TOKEN in the server environment.",
    });
  }
  const header = req.headers.authorization || "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!provided || provided !== configuredToken) {
    return res.status(401).json({ error: "Invalid or missing admin token." });
  }
  next();
}

// ---- Public: a device registers its FCM token after the user grants
// notification permission in the Android app. ----
router.post("/push/register", express.json(), (req, res) => {
  try {
    const { token, platform } = req.body || {};
    const result = push.registerToken(token, platform);
    res.json({ ok: true, subscriberCount: result.count });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

router.post("/push/unregister", express.json(), (req, res) => {
  const { token } = req.body || {};
  if (token) push.removeToken(token);
  res.json({ ok: true });
});

// ---- Admin-only: subscriber count + configuration status ----
router.get("/admin/stats", requireAdmin, (req, res) => {
  res.json({
    subscriberCount: push.getSubscriberCount(),
    firebaseConfigured: push.isConfigured(),
  });
});

// ---- Admin-only: send a broadcast to every subscribed device ----
router.post("/admin/broadcast", requireAdmin, express.json(), async (req, res) => {
  const { title, message } = req.body || {};

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ ok: false, error: "Title is required." });
  }
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ ok: false, error: "Message is required." });
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return res.status(400).json({ ok: false, error: `Title must be under ${MAX_TITLE_LENGTH} characters.` });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ ok: false, error: `Message must be under ${MAX_MESSAGE_LENGTH} characters.` });
  }

  const now = Date.now();
  if (now - lastBroadcastAt < BROADCAST_COOLDOWN_MS) {
    const waitSec = Math.ceil((BROADCAST_COOLDOWN_MS - (now - lastBroadcastAt)) / 1000);
    return res.status(429).json({ ok: false, error: `Please wait ${waitSec}s before sending another broadcast.` });
  }

  if (!push.isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "Firebase is not configured on this server yet — see server/pushService.js.",
    });
  }

  try {
    lastBroadcastAt = now;
    const result = await push.sendBroadcast(title.trim(), message.trim());
    console.log(
      `[admin-broadcast] "${title}" sent — success=${result.successCount} failed=${result.failureCount} removed=${result.removedTokens}`
    );
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("[admin-broadcast] failed:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
