/** Small, bounded, in-memory abuse guards; no new dependencies. */
export const MAX_ACTIVE_ROOMS = 100;
export const MAX_CONNECTED_CLIENTS = 250;
export const MAX_SOCKET_MESSAGE_BYTES = 16 * 1024;

/** Each limiter stores one counter, rather than a growing map of attacker IPs. */
export function fixedWindowLimiter(maxAttempts: number, windowMs: number) {
  let windowStarted = 0;
  let used = 0;
  return (now = Date.now()): boolean => {
    if (now - windowStarted >= windowMs || now < windowStarted) {
      windowStarted = now;
      used = 0;
    }
    if (used >= maxAttempts) return false;
    used += 1;
    return true;
  };
}

// Global caps are intentional: reverse tunnels can make many players appear
// to come from the same local IP. Do not trust arbitrary X-Forwarded-For headers.
export const allowNewConnection = fixedWindowLimiter(300, 60_000);
export const allowNewRoom = fixedWindowLimiter(30, 60_000);

export function allowedOrigins(value: string | undefined, production: boolean): Set<string> {
  if (production && !value?.trim()) {
    throw new Error('FRONTEND_URL must be set to the deployed frontend origin in production.');
  }
  const origins = new Set<string>();
  for (const item of (value || 'http://localhost:5173').split(',')) {
    const candidate = item.trim();
    if (!candidate) continue;
    let parsed: URL;
    try {
      parsed = new URL(candidate);
    } catch {
      throw new Error(`Invalid FRONTEND_URL origin: ${candidate}`);
    }
    if (parsed.origin !== candidate || !['https:', 'http:'].includes(parsed.protocol)) {
      throw new Error(`FRONTEND_URL must contain origins without paths or trailing slashes: ${candidate}`);
    }
    if (production && parsed.protocol !== 'https:') {
      throw new Error('Production FRONTEND_URL origins must use HTTPS.');
    }
    origins.add(candidate);
  }
  if (origins.size === 0) throw new Error('At least one FRONTEND_URL origin is required.');
  return origins;
}

export function isDevelopmentLanOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.port !== '5173' || url.origin !== origin) return false;
    const host = url.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) return false;
    const parts = host.split('.').map(Number);
    if (parts.some(part => part > 255)) return false;
    return parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31);
  } catch {
    return false;
  }
}

export function isAllowedBrowserOrigin(
  origin: string | undefined,
  configured: ReadonlySet<string>,
  production: boolean,
): boolean {
  if (!origin) return !production; // Deny origin-less Socket.IO clients in production.
  return configured.has(origin) || (!production && isDevelopmentLanOrigin(origin));
}
