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
 *   1. The page lives in a template literal. A backslash inside it is eaten
 *      before the browser sees it, so `node --check` passes while the page's
 *      JS is dead. Therefore: NO regex literals and NO escape sequences in
 *      PAGE. check_page.py validates what the browser actually receives.
 *   2. INGEST_TOKEN is a wrangler SECRET, never a [vars] entry -- a plaintext
 *      var of the same name collides with the secret binding (CF error 10053).
 */

const MEASUREMENTS = {
  machine: "Apple M4 Max · 128 GB unified memory",
  runtime: "ollama 0.31.1",
  measured_at: "2026-08-29",
  concurrency: {
    default: { speedup: 0.98, verdict: "SERIALIZED" },
    num_parallel_8: { ceiling: 2.21, ceiling_width: 16, flattens_after: 8 },
    note: "reproduces ollama#17666; the server queues rather than erroring",
  },
  n_parameter: { requested: 4, returned: 1, verdict: "IGNORED" },
  logprobs: {
    verdict: "AVAILABLE",
    note: "corrects our own prior assumption; SMC weighting is not blocked",
  },
  exchange_rate: [
    { model: "qwen3:0.6b", tok_s: 332.4, ceiling: 2.21, candidates_per_30s: 62 },
    { model: "qwen3:1.7b", tok_s: 153.2, ceiling: 1.76, candidates_per_30s: 29 },
    { model: "qwen3:8b", tok_s: 42.2, ceiling: 1.71, candidates_per_30s: 8 },
  ],
  reads_as:
    "13x the parameters costs about 8x the search width, and width is where the method's gain comes from",
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

/* ------------------------------------------------------------------ *
 * PAGE
 * No backslashes anywhere below. No regex literals, no escape
 * sequences. See the header comment for why. check_page.py enforces it
 * against the deployed URL.
 * ------------------------------------------------------------------ */
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>plan-then-cull</title>
<style>
  :root{
    --paper:#f5f5f5; --ink:#2d3142; --muted:#4f5d75; --soft:#7a8399;
    --accent:#eb6c36; --rule:rgba(45,49,66,0.12); --card:#ffffff;
  }
  @media (prefers-color-scheme: dark){
    :root{
      --paper:#2d3142; --ink:#f5f5f5; --muted:#bfc0c0; --soft:#8e98ac;
      --accent:#f08a59; --rule:rgba(245,245,245,0.14); --card:rgba(245,245,245,0.04);
    }
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    line-height:1.5; padding:2rem 1.5rem 4rem;
  }
  .wrap{max-width:1000px;margin:0 auto}
  .eyebrow{
    font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.7rem;
    letter-spacing:.16em; text-transform:uppercase; color:var(--soft); margin:0 0 .5rem;
  }
  h1{font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:2.5rem; margin:0 0 .25rem}
  .sub{color:var(--muted); margin:0 0 2rem; max-width:64ch}
  .tiles{display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:1rem; margin-bottom:2.5rem}
  .tile{background:var(--card); border:1px solid var(--rule); border-radius:6px; padding:1.25rem}
  .tile .k{font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.65rem;
    letter-spacing:.14em; text-transform:uppercase; color:var(--soft)}
  .tile .v{font-size:2.25rem; font-weight:600; margin:.35rem 0 .1rem; letter-spacing:-0.02em}
  .tile .n{font-size:.8rem; color:var(--muted)}
  .tile.focal{border-color:var(--accent)}
  .tile.focal .v{color:var(--accent)}
  table{width:100%; border-collapse:collapse; margin:0 0 2.5rem; font-size:.9rem}
  th,td{text-align:left; padding:.6rem .75rem; border-bottom:1px solid var(--rule)}
  th{font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.65rem;
    letter-spacing:.14em; text-transform:uppercase; color:var(--soft); font-weight:500}
  td.num{font-family:'Geist Mono',ui-monospace,Menlo,monospace; text-align:right}
  tr.focal td{color:var(--accent); font-weight:600}
  h2{font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:1.5rem;
    margin:0 0 .75rem; padding-top:1.5rem; border-top:1px solid var(--rule)}
  .live{background:var(--card); border:1px solid var(--rule); border-radius:6px;
    padding:1.25rem; font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.8rem;
    color:var(--muted); white-space:pre-wrap; word-break:break-word; min-height:4rem}
  footer{margin-top:3rem; padding-top:1rem; border-top:1px solid var(--rule);
    font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.7rem; color:var(--soft)}
  a{color:var(--accent)}
</style>
</head>
<body>
<div class="wrap">
  <p class="eyebrow">Sundai Hack 138 &middot; MIT &middot; 30 Aug 2026</p>
  <h1>plan-then-cull</h1>
  <p class="sub">A big model writes the test. A tiny model takes it sixty times.
  A Python interpreter grades it. Measurements below were taken on the target
  machine the night before the hack.</p>

  <div class="tiles">
    <div class="tile focal">
      <div class="k">Candidates / 30s</div>
      <div class="v">62</div>
      <div class="n">qwen3:0.6b &middot; 332 tok/s</div>
    </div>
    <div class="tile">
      <div class="k">Same, at 8B</div>
      <div class="v">8</div>
      <div class="n">13x params, 8x less width</div>
    </div>
    <div class="tile">
      <div class="k">Concurrency ceiling</div>
      <div class="v">2.21x</div>
      <div class="n">flat after width 8</div>
    </div>
    <div class="tile">
      <div class="k">Default concurrency</div>
      <div class="v">0.98x</div>
      <div class="n">server queues, does not error</div>
    </div>
  </div>

  <h2>The exchange rate</h2>
  <table>
    <thead><tr><th>Model</th><th class="num">Concurrent tok/s</th><th class="num">Ceiling</th><th class="num">Candidates / 30s round</th></tr></thead>
    <tbody>
      <tr class="focal"><td>qwen3:0.6b</td><td class="num">332.4</td><td class="num">2.21x</td><td class="num">62</td></tr>
      <tr><td>qwen3:1.7b</td><td class="num">153.2</td><td class="num">1.76x</td><td class="num">29</td></tr>
      <tr><td>qwen3:8b</td><td class="num">42.2</td><td class="num">1.71x</td><td class="num">8</td></tr>
    </tbody>
  </table>

  <h2>Live round</h2>
  <div class="live" id="live">connecting...</div>

  <footer>
    Apple M4 Max &middot; 128 GB &middot; ollama 0.31.1 &middot; OLLAMA_NUM_PARALLEL=8 &middot;
    <a href="https://github.com/wilsonwu-ai/plan-then-cull">source</a> &middot; MIT
  </footer>
</div>
<script>
  var el = document.getElementById('live');
  function paint(d){
    if (!d || d.status === 'awaiting_rounds') {
      el.textContent = 'awaiting round data from the local runner';
      return;
    }
    el.textContent = JSON.stringify(d, null, 2);
  }
  function poll(){
    fetch('/api/round', {cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(paint)
      .catch(function(){ el.textContent = 'offline'; });
  }
  poll();
  setInterval(poll, 3000);
</script>
</body>
</html>`;
