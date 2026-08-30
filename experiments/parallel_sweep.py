#!/usr/bin/env python3
"""Find the real concurrency ceiling of an Ollama server.

runtime_probe.py answers "is it serialized?" with one number. This answers the
follow-up question a particle method actually needs: *how wide can I go before
adding particles stops buying anything?*

Method: for each requested width N, run N generations sequentially and then the
same N concurrently, and report wall-clock speedup. A server with true N-way
parallelism approaches N. A serialized server stays flat near 1.0 regardless of
how high OLLAMA_NUM_PARALLEL is set.

Longer generations than runtime_probe.py on purpose: short requests are
dominated by fixed per-request overhead, which inflates apparent speedup and
flatters the server. We want the steady-state number.

Stdlib only.

Usage:
    OLLAMA_NUM_PARALLEL=8 ollama serve   # in another shell
    python3 parallel_sweep.py --model qwen3:0.6b --widths 1,2,4,8,16
"""

import argparse
import json
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PROMPT = (
    "List the first 40 prime numbers, separated by commas. "
    "Output only the numbers."
)
NUM_PREDICT = 160  # long enough that decode dominates per-request overhead


def generate(host, model, seed):
    req = urllib.request.Request(
        f"{host}/api/generate",
        data=json.dumps(
            {
                "model": model,
                "prompt": PROMPT,
                "stream": False,
                "options": {
                    "num_predict": NUM_PREDICT,
                    "temperature": 0.8,
                    "seed": seed,
                },
            }
        ).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "plan-then-cull-sweep/1.0"},
    )
    t0 = time.perf_counter()
    with urllib.request.urlopen(req, timeout=600) as r:
        body = json.loads(r.read())
    return time.perf_counter() - t0, body.get("eval_count", 0)


def measure(host, model, width):
    t0 = time.perf_counter()
    seq = [generate(host, model, i) for i in range(width)]
    seq_wall = time.perf_counter() - t0

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=width) as pool:
        con = list(pool.map(lambda i: generate(host, model, i), range(width)))
    con_wall = time.perf_counter() - t0

    seq_tok = sum(t for _, t in seq)
    con_tok = sum(t for _, t in con)
    return {
        "width": width,
        "sequential_wall_s": round(seq_wall, 2),
        "concurrent_wall_s": round(con_wall, 2),
        "speedup": round(seq_wall / con_wall, 2) if con_wall else 0.0,
        "sequential_tok_per_s": round(seq_tok / seq_wall, 1) if seq_wall else 0.0,
        "concurrent_tok_per_s": round(con_tok / con_wall, 1) if con_wall else 0.0,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="http://127.0.0.1:11434")
    ap.add_argument("--model", default="qwen3:0.6b")
    ap.add_argument("--widths", default="1,2,4,8,16")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    widths = [int(w) for w in args.widths.split(",")]

    with urllib.request.urlopen(f"{args.host}/api/version", timeout=5) as r:
        version = json.loads(r.read())["version"]

    print(f"ollama {version}  model={args.model}")
    print(f"{'width':>6} {'seq(s)':>8} {'con(s)':>8} {'speedup':>8} {'seq tok/s':>10} {'con tok/s':>10}")
    print("-" * 56)

    generate(args.host, args.model, seed=0)  # warm weights

    rows = []
    for w in widths:
        r = measure(args.host, args.model, w)
        rows.append(r)
        print(
            f"{r['width']:>6} {r['sequential_wall_s']:>8} {r['concurrent_wall_s']:>8} "
            f"{r['speedup']:>7}x {r['sequential_tok_per_s']:>10} {r['concurrent_tok_per_s']:>10}"
        )

    best = max(rows, key=lambda r: r["speedup"])
    print("-" * 56)
    print(f"ceiling: {best['speedup']}x at width {best['width']}")

    out = {"ollama_version": version, "model": args.model, "rows": rows,
           "ceiling_speedup": best["speedup"], "ceiling_width": best["width"]}
    if args.out:
        with open(args.out, "w") as f:
            json.dump(out, f, indent=2)
        print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
