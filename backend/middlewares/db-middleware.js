import mongoose from "mongoose";

// Middleware to check if database is connected
export const checkDB = (req, res, next) => {
  const state = mongoose.connection.readyState;

  // 1 = connected
  if (state === 1) {
    return next();
  }

  // 0 = disconnected, 2 = connecting, 3 = disconnecting
  const messages = {
    0: "Database disconnected. Please ensure your IP is whitelisted in MongoDB Atlas.",
    2: "Database connecting. Please wait a moment and try again.",
    3: "Database disconnecting. Please try again later.",
  };

  const message = messages[state] || "Database connection unavailable. Check your Atlas IP whitelist.";

  res.status(503).json({
    success: false,
    message,
    diagnostic: "ERR_DB_NOT_CONNECTED",
    atlas_help: "https://www.mongodb.com/docs/atlas/security-whitelist/"
  });
};
