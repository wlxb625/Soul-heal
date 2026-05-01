const DEFAULT_LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:8888",
  "http://127.0.0.1:8888"
];

function getAllowedCorsOrigins(rawOrigins) {
  const configured = String(rawOrigins || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length) {
    return Array.from(new Set(configured));
  }

  return DEFAULT_LOCAL_ORIGINS.slice();
}

function getSessionCookieOptions(nodeEnv) {
  const isProduction = nodeEnv === "production";
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    path: "/"
  };
}

module.exports = {
  DEFAULT_LOCAL_ORIGINS,
  getAllowedCorsOrigins,
  getSessionCookieOptions
};
