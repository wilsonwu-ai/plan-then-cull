#!/usr/bin/env python3
"""Probe an Ollama server for the three capabilities particle methods depend on.

DisCIPL-style inference (arXiv:2504.07081) runs N copies of a small model in
parallel and culls them between rounds. Three runtime properties decide whether
that is buildable on a given machine:

  1. Does the server actually run concurrent requests in parallel, or queue them?
  2. Does it support n>1 (multiple samples from one request)?
  3. Does it expose per-token logprobs (needed for true SMC weighting)?

Each is answered by measurement, not by reading docs. A serialized server does
not error -- it just queues, and the natural misreading is "small models are
slow" rather than "my server is single-threaded".

Stdlib only. No install step.

Usage:
    python3 runtime_probe.py                    # defaults: qwen3:1.7b, 8 requests
    python3 runtime_probe.py --model qwen3:0.6b --n 12
"""

import argparse
import json
import statistics
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

DEFAULT_HOST = "http://127.0.0.1:11434"
# Deliberately boring and identical across requests: we are timing the server's
# scheduler, not the model's reasoning. Fixed token budget keeps runs comparable.
PROMPT = "Count from 1 to 20, separated by spaces. Output only the numbers."
NUM_PREDICT = 48


def _post(url, payload, timeout=300):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            # Cloudflare and some proxies reject urllib's default UA. Harmless
            # locally, and it means this script survives being pointed at a
            # tunneled endpoint. Found the hard way on a previous project.
            "User-Agent": "plan-then-cull-probe/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def one_generation(host, model, seed):
    """One non-streaming generation. Returns (wall_seconds, eval_count)."""
    t0 = time.perf_counter()
    body = _post(
        f"{host}/api/generate",
        {
            "model": model,
            "prompt": PROMPT,
            "stream": False,
            "options": {
                "num_predict": NUM_PREDICT,
                "temperature": 0.8,  # >0: particle methods need diverse draws
                "seed": seed,
            },
        },
    )
    return time.perf_counter() - t0, body.get("eval_count", 0)


def probe_concurrency(host, model, n):
    """The load-bearing test.

    Run n generations sequentially, then the same n concurrently. On a server
    that parallelises, concurrent wall-clock is far below sequential. On one
    that serialises, the two are within noise of each other -- and every
    parallel-sampling technique silently costs n times what you budgeted.
    """
    print(f"  warming model ({model})...", flush=True)
    one_generation(host, model, seed=0)  # load weights; excluded from timings

    print(f"  sequential x{n}...", flush=True)
    t0 = time.perf_counter()
    seq = [one_generation(host, model, seed=i) for i in range(n)]
    sequential_wall = time.perf_counter() - t0

    print(f"  concurrent x{n}...", flush=True)
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=n) as pool:
        con = list(pool.map(lambda i: one_generation(host, model, seed=i), range(n)))
    concurrent_wall = time.perf_counter() - t0

    speedup = sequential_wall / concurrent_wall if concurrent_wall else 0.0
    # A perfectly serialised server gives ~1.0x. Real parallelism on n workers
    # gives meaningfully more. 1.5x is a deliberately generous floor: anything
    # under it cannot support a particle method at useful width.
    return {
        "n": n,
        "sequential_wall_s": round(sequential_wall, 2),
        "concurrent_wall_s": round(concurrent_wall, 2),
        "speedup": round(speedup, 2),
        "sequential_per_req_s": round(statistics.mean(d for d, _ in seq), 2),
        "concurrent_per_req_s": round(statistics.mean(d for d, _ in con), 2),
        "verdict": "PARALLEL" if speedup >= 1.5 else "SERIALIZED",
    }


def probe_n_parameter(host, model):
    """Does the OpenAI-compatible endpoint honour n>1?

    Best-of-N and self-consistency both want k samples per prompt. If n>1 is
    unsupported, every sample is a separate round-trip and the cost model
    changes completely.
    """
    try:
        body = _post(
            f"{host}/v1/chat/completions",
            {
                "model": model,
                "messages": [{"role": "user", "content": PROMPT}],
                "n": 4,
                "max_tokens": NUM_PREDICT,
                "temperature": 0.8,
            },
        )
        got = len(body.get("choices", []))
        return {
            "requested": 4,
            "returned": got,
            "verdict": "SUPPORTED" if got > 1 else "IGNORED",
        }
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        return {"requested": 4, "returned": 0, "verdict": f"ERROR: {e}"}


def probe_logprobs(host, model):
    """Are per-token logprobs exposed?

    True Sequential Monte Carlo weights particles by conditional probability.
    Without logprobs you cannot implement the paper's algorithm as written --
    you can only approximate it with sequence-level culling.
    """
    try:
        body = _post(
            f"{host}/v1/chat/completions",
            {
                "model": model,
                "messages": [{"role": "user", "content": PROMPT}],
                "max_tokens": 16,
                "logprobs": True,
                "top_logprobs": 3,
            },
        )
        lp = (body.get("choices") or [{}])[0].get("logprobs")
        present = bool(lp and lp.get("content"))
        return {"verdict": "AVAILABLE" if present else "DROPPED", "raw": lp}
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        return {"verdict": f"ERROR: {e}", "raw": None}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=DEFAULT_HOST)
    ap.add_argument("--model", default="qwen3:1.7b")
    ap.add_argument("--n", type=int, default=8)
    ap.add_argument("--out", default=None, help="write JSON results here")
    args = ap.parse_args()

    try:
        with urllib.request.urlopen(f"{args.host}/api/version", timeout=5) as r:
            version = json.loads(r.read()).get("version", "unknown")
    except OSError:
        print(f"No Ollama server at {args.host}. Start it with: ollama serve", file=sys.stderr)
        return 1

    print(f"ollama {version} @ {args.host}  model={args.model}\n")

    print("[1/3] concurrency")
    conc = probe_concurrency(args.host, args.model, args.n)
    print(f"      sequential {conc['sequential_wall_s']}s   concurrent {conc['concurrent_wall_s']}s"
          f"   speedup {conc['speedup']}x  ->  {conc['verdict']}\n")

    print("[2/3] n>1 sampling")
    npar = probe_n_parameter(args.host, args.model)
    print(f"      requested 4, returned {npar['returned']}  ->  {npar['verdict']}\n")

    print("[3/3] per-token logprobs")
    lp = probe_logprobs(args.host, args.model)
    print(f"      {lp['verdict']}\n")

    results = {
        "ollama_version": version,
        "model": args.model,
        "concurrency": conc,
        "n_parameter": npar,
        "logprobs": {"verdict": lp["verdict"]},
    }

    # The point of the probe: turn three measurements into one build decision.
    if conc["verdict"] == "SERIALIZED":
        results["implication"] = (
            "Server serialises concurrent requests. A particle population costs "
            "N x single-request latency in wall-clock. Budget width accordingly, "
            "and cull between visible rounds rather than running true parallel SMC."
        )
    else:
        results["implication"] = (
            "Server parallelises. A particle population is affordable at width N."
        )

    if args.out:
        with open(args.out, "w") as f:
            json.dump(results, f, indent=2)
        print(f"wrote {args.out}")

    print("IMPLICATION:", results["implication"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
