/**
 * plan-then-cull -- public demo surface.
 *
 * Deployed the night before Sundai Hack 138 so that the 16:30 deploy tomorrow
 * is a RE-deploy, not a first attempt. Sundai's hard rule is "get off the
 * localhost" -- this is the URL that satisfies it.
 *
 * Routes:
 *   GET  /              the page (measurements now, live rounds tomorrow)
 *   GET  /api/results   the runtime measurements as JSON
 *   GET  /api/round     the most recent round posted by the local runner
 *   POST /api/round     ingest a round  (Bearer INGEST_TOKEN)
 *   GET  /api/live      strongly consistent public demo snapshot
 *   POST /api/live/join anonymous, cookie-deduplicated audience join
 *   POST /api/live/run  validated live state  (Bearer INGEST_TOKEN)
 *   GET  /health        liveness
 *
 * Two traps this file deliberately avoids, both learned the hard way:
 *   1. The page lives in a template literal (see page.js). A backslash inside
 *      it is eaten before the browser sees it, so `node --check` passes while
 *      the page's JS is dead. Therefore: NO regex literals and NO escape
 *      sequences in PAGE. check_page.py validates what the browser receives.
 *   2. INGEST_TOKEN is a wrangler SECRET, never a [vars] entry -- a plaintext
 *      var of the same name collides with the secret binding (CF error 10053).
 */

import { PAGE } from "./page.js";
import { BENCH_PY_B64 } from "./bench_asset.js";
import {
  LIVE_SESSION_ID,
  MAX_RUN_BYTES,
  validateRunPayload,
} from "./live_room.js";

export { LiveRoom } from "./live_room.js";

/* ---------------------------- leaderboard ----------------------------- *
 * POST /api/bench is PUBLIC and unauthenticated on purpose: the whole point
 * is that a room full of strangers can submit in one command. That makes
 * strict validation the only thing standing between us and a defaced board
 * on a projector, so every field is type-checked, range-checked and length-
 * capped here, and the page renders submissions with textContent (never
 * innerHTML) so a submitted string cannot become markup.
 * ---------------------------------------------------------------------- */

const BOARD_MAX = 100;

function clean(s, max) {
  if (typeof s !== "string") return null;
  // Strip control characters; they render as garbage and can hide content.
  let out = "";
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (c >= 32 && c !== 127) out += ch;
  }
  out = out.trim().slice(0, max);
  return out.length ? out : null;
}

function num(v, lo, hi) {
  if (typeof v !== "number" || !isFinite(v)) return null;
  if (v < lo || v > hi) return null;
  return Math.round(v * 100) / 100;
}

function validateEntry(b) {
  const name = clean(b.name, 40) || "anonymous";
  const model = clean(b.model, 60);
  const tok_s = num(b.tok_s, 0, 100000);
  const cands = num(b.candidates_per_30s, 0, 100000);
  const ceiling = num(b.ceiling, 0, 1000);
  // A submission with no model or no throughput measures nothing. Reject it
  // rather than putting a row of nulls on the projector.
  if (!model || tok_s === null || cands === null || ceiling === null) return null;
  return {
    name, model, tok_s,
    candidates_per_30s: cands,
    ceiling,
    params_b: num(b.params_b, 0, 10000),
    os: clean(b.os, 40) || "unknown",
    cpu: clean(b.cpu, 60) || "unknown",
    at: new Date().toISOString(),
  };
}

async function handleBench(request, env) {
  if (request.method === "GET") {
    const raw = env.ROUNDS ? await env.ROUNDS.get("board") : null;
    const board = raw ? JSON.parse(raw) : [];
    return new Response(JSON.stringify({ count: board.length, board }, null, 2), {
      headers: JSON_HEADERS,
    });
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: JSON_HEADERS,
    });
  }
  if (!env.ROUNDS) {
    return new Response(JSON.stringify({ error: "kv_not_bound" }), {
      status: 503, headers: JSON_HEADERS,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400, headers: JSON_HEADERS,
    });
  }

  const entry = validateEntry(body);
  if (!entry) {
    return new Response(JSON.stringify({ error: "invalid_entry" }), {
      status: 422, headers: JSON_HEADERS,
    });
  }

  const raw = await env.ROUNDS.get("board");
  const board = raw ? JSON.parse(raw) : [];
  board.push(entry);
  board.sort((a, b) => b.candidates_per_30s - a.candidates_per_30s);
  const trimmed = board.slice(0, BOARD_MAX);
  await env.ROUNDS.put("board", JSON.stringify(trimmed));

  const rank = trimmed.findIndex(
    (e) => e.at === entry.at && e.name === entry.name
  );
  return new Response(
    JSON.stringify({ ok: true, rank: rank >= 0 ? rank + 1 : null, total: trimmed.length }),
    { headers: JSON_HEADERS }
  );
}

const MEASUREMENTS = {
  machine: "Apple M4 Max · 128 GB unified memory",
  runtime: "ollama 0.31.1",
  measured_at: "2026-08-30",
  concurrency: {
    default: { speedup: 0.98, verdict: "SERIALIZED", note: "before OLLAMA_NUM_PARALLEL was set" },
    num_parallel_8: { ceiling: 3.26, ceiling_width: 16 },
    note: "reproduces ollama#17666; the server queues rather than erroring",
  },
  n_parameter: { requested: 4, returned: 1, verdict: "IGNORED" },
  logprobs: {
    verdict: "AVAILABLE",
    note: "corrects our own prior assumption; SMC weighting is not blocked",
  },
  exchange_rate: [
    { model: "qwen3:0.6b", tok_s: 696.9, ceiling: 3.26, candidates_per_30s: 131 },
    { model: "qwen3:1.7b", tok_s: 363.6, ceiling: 1.8, candidates_per_30s: 68 },
    { model: "qwen3:8b", tok_s: 95.2, ceiling: 1.34, candidates_per_30s: 18 },
  ],
  reads_as:
    "13x the parameters costs about 7x the search width, and width is where the method's gain comes from",
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

const BASE_SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
};

const PAGE_SECURITY_HEADERS = {
  ...BASE_SECURITY_HEADERS,
  "content-security-policy": [
    "default-src 'self'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; "),
};

function jsonError(error, status, extraHeaders = {}) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function withHeaders(response, headers) {
  const next = new Response(response.body, response);
  for (const [name, value] of Object.entries(headers)) next.headers.set(name, value);
  return next;
}

async function constantTimeEqual(left, right) {
  const encoder = new TextEncoder();
  const [leftHash, rightHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ]);
  const a = new Uint8Array(leftHash);
  const b = new Uint8Array(rightHash);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function readJsonLimited(request, maxBytes) {
  const declared = request.headers.get("content-length");
  if (declared !== null) {
    const declaredBytes = Number(declared);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0 || declaredBytes > maxBytes) {
      return { error: "body_too_large", status: 413 };
    }
  }
  if (!request.body) return { error: "bad_json", status: 400 };

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return { error: "body_too_large", status: 413 };
    }
    chunks.push(part.value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch (error) {
    return { error: "bad_json", status: 400 };
  }
}

async function hasRequestBodyBytes(request) {
  const declared = request.headers.get("content-length");
  if (declared !== null && Number(declared) > 0) return true;
  if (!request.body) return false;
  const reader = request.body.getReader();
  while (true) {
    const part = await reader.read();
    if (part.done) return false;
    if (part.value.byteLength > 0) {
      await reader.cancel();
      return true;
    }
  }
}

function liveRoom(env) {
  return env.LIVE_ROOM.getByName(LIVE_SESSION_ID);
}

async function handleLive(request, env, route) {
  if (!env.LIVE_ROOM) return jsonError("live_room_not_bound", 503);

  if (route === "state") {
    if (request.method !== "GET") return jsonError("method_not_allowed", 405, { allow: "GET" });
    const response = await liveRoom(env).fetch("https://live.internal/state");
    return withHeaders(response, BASE_SECURITY_HEADERS);
  }

  if (route === "join") {
    if (request.method !== "POST") return jsonError("method_not_allowed", 405, { allow: "POST" });
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if (origin !== url.origin || (fetchSite && fetchSite !== "same-origin")) {
      return jsonError("same_origin_required", 403);
    }
    if (await hasRequestBodyBytes(request)) return jsonError("join_body_not_allowed", 400);

    const response = await liveRoom(env).fetch("https://live.internal/join", {
      method: "POST",
      headers: { cookie: request.headers.get("cookie") || "" },
    });
    return withHeaders(response, BASE_SECURITY_HEADERS);
  }

  if (route === "run") {
    if (request.method !== "POST") return jsonError("method_not_allowed", 405, { allow: "POST" });
    const auth = request.headers.get("authorization") || "";
    const expected = "Bearer " + (env.INGEST_TOKEN || "");
    if (!env.INGEST_TOKEN || !(await constantTimeEqual(auth, expected))) {
      return jsonError("unauthorized", 401);
    }
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return jsonError("content_type_must_be_json", 415);
    }

    const parsed = await readJsonLimited(request, MAX_RUN_BYTES);
    if (parsed.error) return jsonError(parsed.error, parsed.status);
    const validated = validateRunPayload(parsed.value);
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: "invalid_run", fields: validated.errors }), {
        status: 422,
        headers: JSON_HEADERS,
      });
    }

    const response = await liveRoom(env).fetch("https://live.internal/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validated.value),
    });
    return withHeaders(response, BASE_SECURITY_HEADERS);
  }

  return jsonError("not_found", 404);
}

async function handleRound(request, env) {
  if (request.method === "GET") {
    const stored = env.ROUNDS ? await env.ROUNDS.get("latest") : null;
    return new Response(stored || JSON.stringify({ status: "awaiting_rounds" }), {
      headers: JSON_HEADERS,
    });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  const auth = request.headers.get("authorization") || "";
  const expected = "Bearer " + (env.INGEST_TOKEN || "");
  // No token configured means no ingest. Fail closed rather than open.
  if (!env.INGEST_TOKEN || auth !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: JSON_HEADERS,
    });
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "bad_json" }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  if (!env.ROUNDS) {
    return new Response(JSON.stringify({ error: "kv_not_bound" }), {
      status: 503,
      headers: JSON_HEADERS,
    });
  }

  const record = JSON.stringify({ received_at: new Date().toISOString(), round: body });
  await env.ROUNDS.put("latest", record);
  return new Response(record, { headers: JSON_HEADERS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ ok: true }), { headers: JSON_HEADERS });
    }

    if (url.pathname === "/api/results") {
      return new Response(JSON.stringify(MEASUREMENTS, null, 2), { headers: JSON_HEADERS });
    }

    if (url.pathname === "/api/live") {
      return handleLive(request, env, "state");
    }

    if (url.pathname === "/api/live/join") {
      return handleLive(request, env, "join");
    }

    if (url.pathname === "/api/live/run") {
      return handleLive(request, env, "run");
    }

    if (url.pathname === "/api/round") {
      return handleRound(request, env);
    }

    if (url.pathname === "/api/bench") {
      return handleBench(request, env);
    }

    // Served as text/plain so `curl -sO` gets the file and a browser shows it.
    // Readable before running: nobody should pipe a stranger's script blind.
    if (url.pathname === "/bench.py") {
      return new Response(atob(BENCH_PY_B64), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
          ...BASE_SECURITY_HEADERS,
        },
      });
    }

    if (url.pathname === "/") {
      return new Response(PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          ...PAGE_SECURITY_HEADERS,
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
};
