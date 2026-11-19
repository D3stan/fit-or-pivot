import net from 'node:net';
import type { IncomingMessage } from 'node:http';

function normalizeIp(raw: string | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/^::ffff:/i, '');
  return net.isIP(stripped) !== 0 ? stripped : null;
}

/**
 * Extract the client IP address from an incoming HTTP request.
 * Behind Traefik, prefers `x-real-ip`, then the rightmost valid IP in
 * `x-forwarded-for`, and finally `req.socket.remoteAddress`.
 */
export function extractClientIp(req: IncomingMessage): string {
  const realIpHeader = req.headers['x-real-ip'];
  const realIpRaw = Array.isArray(realIpHeader) ? realIpHeader[0] : realIpHeader;
  const realIp = normalizeIp(realIpRaw);
  if (realIp) return realIp;

  const xffHeader = req.headers['x-forwarded-for'];
  if (xffHeader) {
    const xffRaw = Array.isArray(xffHeader) ? xffHeader.join(',') : xffHeader;
    const parts = xffRaw.split(',');
    for (let i = parts.length - 1; i >= 0; i--) {
      const candidate = normalizeIp(parts[i]);
      if (candidate) return candidate;
    }
  }

  return normalizeIp(req.socket?.remoteAddress) ?? 'unknown';
}
