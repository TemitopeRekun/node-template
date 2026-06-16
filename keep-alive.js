const { appLogger } = require('@app-core/logger');

// Render free instances sleep after ~15 minutes with no inbound traffic. Pinging
// the service's own public URL on a shorter interval keeps it awake at no cost.
// Render injects RENDER_EXTERNAL_URL automatically; KEEP_ALIVE_URL can override.
const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

function stripTrailingSlashes(str) {
  let end = str.length;
  while (end > 0 && str[end - 1] === '/') {
    end -= 1;
  }
  return str.slice(0, end);
}

function startKeepAlive() {
  const baseUrl = process.env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL;

  // No URL (e.g. local dev) or no fetch available -> do nothing.
  if (!baseUrl || typeof fetch !== 'function') {
    return null;
  }

  const intervalMs = parseInt(process.env.KEEP_ALIVE_INTERVAL_MS, 10) || DEFAULT_INTERVAL_MS;
  const target = `${stripTrailingSlashes(baseUrl)}/`;

  const timer = setInterval(async () => {
    try {
      const res = await fetch(target, { method: 'GET' });
      appLogger.info({ target, status: res.status }, 'keep-alive-ping');
    } catch (error) {
      appLogger.error({ target, error: error.message }, 'keep-alive-ping-failed');
    }
  }, intervalMs);

  // Don't let the keep-alive timer alone hold the process open.
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  appLogger.info({ target, intervalMs }, 'keep-alive-started');
  return timer;
}

module.exports = { startKeepAlive };
