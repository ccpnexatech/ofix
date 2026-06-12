import type { NextRequest } from 'next/server';

/**
 * Same-origin proxy to the API (spec 003 / ADR-008): no CORS in the browser
 * and the httpOnly refresh cookie works identically in dev and production.
 *
 * A route handler instead of next.config rewrites on purpose: rewrite
 * destinations are baked into the build, so a deployment built before
 * API_ORIGIN existed silently proxies to localhost (Vercel:
 * DNS_HOSTNAME_RESOLVED_PRIVATE). Here the env is read PER REQUEST.
 */

export const dynamic = 'force-dynamic';

/** Hop-by-hop headers must not be forwarded (RFC 9110 §7.6.1). */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  // fetch() transparently decompresses the upstream body; forwarding the
  // original content-encoding makes browsers try to decompress AGAIN
  // (ERR_CONTENT_DECODING_FAILED). Same for the inbound accept-encoding:
  // undici negotiates its own.
  'content-encoding',
  'accept-encoding',
]);

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const origin = process.env.API_ORIGIN ?? 'http://localhost:3001';
  const target = new URL(`/api/v1/${path.join('/')}${request.nextUrl.search}`, origin);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    ...(hasBody ? { body: request.body, duplex: 'half' } : {}),
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'set-cookie') {
      responseHeaders.set(key, value);
    }
  });
  // set-cookie can occur multiple times and must never be merged.
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append('set-cookie', cookie);
  }

  // Streams the body through — SSE (Fia chat) included.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
};
