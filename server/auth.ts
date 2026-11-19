import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { sendJson } from './http.js';

let warnedAdminFallback = false;
let warnedMcpFallback = false;

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

function timingSafeSecretEqual(provided: string, expected: string): boolean {
  return timingSafeEqual(sha256(provided), sha256(expected));
}

function getAdminPassword(): string | null {
  const configured = process.env.ADMIN_PASSWORD;
  if (configured && configured.length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  if (!warnedAdminFallback) {
    warnedAdminFallback = true;
    console.warn('[auth] ADMIN_PASSWORD is not set; using development fallback password "admin"');
  }
  return 'admin';
}

function getMcpToken(): string | null {
  const configured = process.env.MCP_TOKEN || process.env.ADMIN_PASSWORD;
  if (configured && configured.length > 0) {
    return configured;
  }
  if (process.env.NODE_ENV === 'production') {
    return null;
  }
  if (!warnedMcpFallback && !warnedAdminFallback) {
    warnedMcpFallback = true;
    console.warn('[auth] MCP_TOKEN and ADMIN_PASSWORD are not set; using development fallback token "admin"');
  }
  return 'admin';
}

interface ParsedAuth {
  scheme: 'basic' | 'bearer';
  secret: string;
}

function parseAuthorizationHeader(header: string | undefined): ParsedAuth | null {
  if (!header) return null;
  const trimmed = header.trim();
  const match = /^(\S+)\s+(.+)$/.exec(trimmed);
  if (!match) return null;

  const scheme = match[1].toLowerCase();
  const credentials = match[2].trim();

  if (scheme === 'bearer') {
    return credentials.length > 0 ? { scheme: 'bearer', secret: credentials } : null;
  }

  if (scheme === 'basic') {
    if (credentials.length === 0 || credentials.length % 4 !== 0) {
      return null;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(credentials)) {
      return null;
    }
    const decoded = Buffer.from(credentials, 'base64').toString('utf8');
    const colonIdx = decoded.indexOf(':');
    if (colonIdx === -1) {
      return null;
    }
    return { scheme: 'basic', secret: decoded.slice(colonIdx + 1) };
  }

  return null;
}

const ADMIN_SECURITY_HEADERS: Record<string, string> = {
  'x-robots-tag': 'noindex, nofollow',
  'cache-control': 'no-store',
};

/**
 * Enforce HTTP Basic Auth for `/admin` and `/api/admin/*`.
 * Fails closed (503) in production when `ADMIN_PASSWORD` is unset.
 */
export function requireAdminAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = getAdminPassword();
  if (expected === null) {
    sendJson(res, 503, { error: 'Admin authentication is not configured' }, ADMIN_SECURITY_HEADERS);
    return false;
  }

  const parsed = parseAuthorizationHeader(req.headers.authorization);
  if (parsed && parsed.scheme === 'basic' && timingSafeSecretEqual(parsed.secret, expected)) {
    return true;
  }

  sendJson(
    res,
    401,
    { error: 'Unauthorized' },
    {
      ...ADMIN_SECURITY_HEADERS,
      'www-authenticate': 'Basic realm="Fit or Pivot Admin"',
    },
  );
  return false;
}

/**
 * Enforce Bearer or Basic Auth for `/mcp`.
 * Fails closed (503) in production when neither `MCP_TOKEN` nor `ADMIN_PASSWORD` is set.
 */
export function requireMcpAuth(req: IncomingMessage, res: ServerResponse): boolean {
  const expected = getMcpToken();
  if (expected === null) {
    sendJson(res, 503, { error: 'MCP authentication is not configured' }, { 'cache-control': 'no-store' });
    return false;
  }

  const parsed = parseAuthorizationHeader(req.headers.authorization);
  if (parsed && timingSafeSecretEqual(parsed.secret, expected)) {
    return true;
  }

  sendJson(
    res,
    401,
    { error: 'Unauthorized' },
    {
      'cache-control': 'no-store',
      'www-authenticate': 'Bearer realm="Fit or Pivot MCP"',
    },
  );
  return false;
}

function extractUrlHost(rawUrl: string | undefined): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * CSRF guard for mutating admin endpoints (`POST`, `DELETE`).
 * Requires `X-Requested-With: fetch` or a matching `Origin`/`Referer` host.
 */
export function requireSameOriginOrAjax(req: IncomingMessage, res: ServerResponse): boolean {
  const xRequestedWith = req.headers['x-requested-with'];
  const requestedWithVal = Array.isArray(xRequestedWith) ? xRequestedWith[0] : xRequestedWith;
  if (typeof requestedWithVal === 'string' && requestedWithVal.trim().toLowerCase() === 'fetch') {
    return true;
  }

  const hostHeader = req.headers.host?.trim().toLowerCase();
  if (hostHeader) {
    const originHeader = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    if (originHeader) {
      if (extractUrlHost(originHeader) === hostHeader) {
        return true;
      }
      sendJson(res, 403, { error: 'Forbidden: cross-origin request' }, ADMIN_SECURITY_HEADERS);
      return false;
    }

    const refererHeader = Array.isArray(req.headers.referer) ? req.headers.referer[0] : req.headers.referer;
    if (refererHeader && extractUrlHost(refererHeader) === hostHeader) {
      return true;
    }
  }

  sendJson(
    res,
    403,
    { error: 'Forbidden: missing X-Requested-With or same-origin header' },
    ADMIN_SECURITY_HEADERS,
  );
  return false;
}
