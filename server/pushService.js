/**
 * server/pushService.js
 *
 * Push notification architecture for Black Hole 21. This module is safe
 * to load even when Firebase is not configured — every function that
 * would actually talk to Firebase checks for configuration first and
 * throws/returns a clear "not configured" result instead of pretending
 * to work.
 *
 * ============================================================
 * WHAT YOU STILL NEED TO DO BEFORE THIS ACTUALLY SENDS PUSHES
 * ============================================================
 * 1. Create a Firebase project (console.firebase.google.com), add an
 *    Android app with package name com.blackhole21.game, and download
 *    google-services.json into android/app/. That file is required for
 *    the Android app to receive pushes and is safe to commit (it does
 *    NOT contain a private key) — but confirm your Firebase project
 *    settings before committing anything.
 * 2. Generate a service account key: Firebase Console → Project
 *    Settings → Service Accounts → Generate new private key. This DOES
 *    contain a private key. NEVER commit this file.
 * 3. On your server (Render), set the environment variable
 *    FIREBASE_SERVICE_ACCOUNT to the full JSON contents of that file
 *    (as a single-line string). Render's dashboard supports multi-line
 *    env vars, or base64-encode it and decode here — either works, just
 *    keep it out of the repo.
 * 4. Run `npm install firebase-admin` — this is intentionally NOT in
 *    package.json yet, so this scaffold doesn't add ~15MB of dependency
 *    weight to a deploy that isn't using it. Install it when you're
 *    ready to actually wire this up.
 * 5. Add the Capacitor push notifications plugin to the Android app
 *    (`@capacitor/push-notifications`), request permission, obtain the
 *    device's FCM token, and POST it to `/api/push/register` (see
 *    server/adminRoutes.js) so it lands in the token store below.
 *
 * Until all of the above is done, isConfigured() returns false and
 * sendBroadcast() will refuse to run instead of silently no-op'ing.
 */

// ---- Device token store -------------------------------------------
//
// In-memory for now — matches the rest of this project's "no database
// required" philosophy. This means the subscriber list resets on every
// server restart/redeploy, same tradeoff as the game rooms themselves.
// If you want push subscriptions to survive restarts, swap this Map for
// a real store (e.g. a small SQLite file, or a hosted DB) — the rest of
// this module doesn't care how tokens are persisted.

const tokens = new Map(); // fcmToken -> { registeredAt, platform }

function registerToken(token, platform = "android") {
  if (!token || typeof token !== "string" || token.length < 10) {
    throw new Error("Invalid push token.");
  }
  tokens.set(token, { registeredAt: Date.now(), platform });
  return { count: tokens.size };
}

function removeToken(token) {
  tokens.delete(token);
}

function getSubscriberCount() {
  return tokens.size;
}

// ---- Firebase Admin SDK (lazy-loaded, only if configured) ---------

let firebaseApp = null;

function isConfigured() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT);
}

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;
  if (!isConfigured()) {
    throw new Error(
      "Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT and run `npm install firebase-admin` first."
    );
  }
  // Lazy require so a missing `firebase-admin` package doesn't crash the
  // whole server on boot — only this code path needs it, and only once
  // FIREBASE_SERVICE_ACCOUNT is actually set.
  let admin;
  try {
    admin = require("firebase-admin");
  } catch (e) {
    throw new Error(
      "firebase-admin is not installed. Run `npm install firebase-admin` on the server."
    );
  }
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return firebaseApp;
}

/**
 * Sends a notification to every registered device. Invalid/expired
 * tokens are removed from the store automatically based on FCM's
 * per-token error response.
 *
 * Returns { successCount, failureCount, removedTokens }.
 * Throws if Firebase isn't configured — callers must handle that.
 */
async function sendBroadcast(title, body, data = {}) {
  if (!isConfigured()) {
    throw new Error("Firebase is not configured — see server/pushService.js for setup steps.");
  }
  if (tokens.size === 0) {
    return { successCount: 0, failureCount: 0, removedTokens: 0, note: "No subscribed devices." };
  }

  const admin = require("firebase-admin");
  getFirebaseApp();

  const tokenList = Array.from(tokens.keys());
  const message = {
    notification: { title, body },
    data,
    tokens: tokenList,
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  let removedTokens = 0;
  response.responses.forEach((res, i) => {
    if (!res.success) {
      const code = res.error && res.error.code;
      if (
        code === "messaging/invalid-registration-token" ||
        code === "messaging/registration-token-not-registered"
      ) {
        tokens.delete(tokenList[i]);
        removedTokens++;
      }
    }
  });

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    removedTokens,
  };
}

module.exports = {
  registerToken,
  removeToken,
  getSubscriberCount,
  isConfigured,
  sendBroadcast,
};
