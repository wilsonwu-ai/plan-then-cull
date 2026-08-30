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
};

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
        },
      });
    }

    if (url.pathname === "/") {
      return new Response(PAGE, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    return new Response("not found", { status: 404 });
  },
};
