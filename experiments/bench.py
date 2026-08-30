#!/usr/bin/env python3
"""plan-then-cull -- audience benchmark. Sundai Hack 138, MIT, 30 Aug 2026.

WHAT THIS DOES
    Measures two things about YOUR machine and posts them to a live leaderboard:

      1. candidates/30s -- how many complete answers your setup can generate in
         thirty seconds. This is the metric the whole project turns on: the
         method wins by generating many attempts and deleting the bad ones, so
         "attempts per unit time" is the currency.

      2. concurrency ceiling -- how much faster your server gets when you ask
         for N answers at once instead of one at a time. We measured 3.26x on
         an M4 Max. Nobody knows what it is on your machine. That is the point.

WHAT IT SENDS
    model name, parameter count, your OS/CPU, tokens/sec, the two numbers above,
    and a display name you choose. Nothing else. No prompts, no generated text,
    no file paths, no environment variables. Read send_payload() below -- it is
    twelve lines and it is the entire wire format.

WHAT IT NEEDS
    Ollama running with at least one model pulled. It uses whatever you already
    have -- it will not download anything.

RUN IT
    python3 bench.py                      # auto-picks your smallest model
    python3 bench.py --model qwen3:0.6b   # or name one
    python3 bench.py --name "Your Name"   # how you appear on the board
    python3 bench.py --dry-run            # measure, print, send nothing

Stdlib only. No pip install. MIT licensed.
"""

import argparse
import json
import platform
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BOARD = "https://plan-then-cull.wilson-af8.workers.dev"
OLLAMA = "http://127.0.0.1:11434"
UA = {"User-Agent": "plan-then-cull-bench/1.0"}

# Identical for everyone, or the leaderboard compares nothing.
PROMPT = "List the first 40 prime numbers, separated by commas. Output only the numbers."
NUM_PREDICT = 160          # one "candidate" is 160 tokens
ROUND_SECONDS = 30         # the denominator everyone is scored against


def _req(url, payload=None, timeout=600, headers=None):
    h = dict(UA)
    if headers:
        h.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        h["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def list_models():
    try:
        return [m["name"] for m in _req(f"{OLLAMA}/api/tags", timeout=10).get("models", [])]
    except OSError:
        return []


def model_size_b(name):
    """Parameter count in billions, parsed from the tag. Best effort."""
    tag = name.lower()
    for part in tag.replace(":", "-").split("-"):
        if part.endswith("b"):
            try:
                return float(part[:-1])
            except ValueError:
                pass
    return None


def generate(model, seed):
    t0 = time.perf_counter()
    body = _req(f"{OLLAMA}/api/generate", {
        "model": model, "prompt": PROMPT, "stream": False,
        "options": {"num_predict": NUM_PREDICT, "temperature": 0.8, "seed": seed},
    })
    return time.perf_counter() - t0, body.get("eval_count", 0)


def measure(model, width):
    t0 = time.perf_counter()
    seq = [generate(model, i) for i in range(width)]
    seq_wall = time.perf_counter() - t0

    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=width) as pool:
        con = list(pool.map(lambda i: generate(model, i), range(width)))
    con_wall = time.perf_counter() - t0

    return {
        "seq_wall": seq_wall,
        "con_wall": con_wall,
        "speedup": seq_wall / con_wall if con_wall else 0.0,
        "con_tok_s": sum(t for _, t in con) / con_wall if con_wall else 0.0,
        "seq_tok_s": sum(t for _, t in seq) / seq_wall if seq_wall else 0.0,
    }


def send_payload(result, name, model, dry_run):
    """The complete wire format. Nothing leaves your machine that is not here."""
    payload = {
        "name": name[:40],
        "model": model[:60],
        "params_b": model_size_b(model),
        "os": f"{platform.system()} {platform.machine()}"[:40],
        "cpu": platform.processor()[:60] or "unknown",
        "tok_s": round(result["con_tok_s"], 1),
        "candidates_per_30s": round(result["con_tok_s"] * ROUND_SECONDS / NUM_PREDICT),
        "ceiling": round(result["speedup"], 2),
    }
    if dry_run:
        print("\n--- would send (dry run, nothing sent) ---")
        print(json.dumps(payload, indent=2))
        return None
    return _req(f"{BOARD}/api/bench", payload, timeout=30)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default=None, help="model tag; default = smallest you have")
    ap.add_argument("--name", default=None, help="how you appear on the leaderboard")
    ap.add_argument("--width", type=int, default=8, help="how many at once (default 8)")
    ap.add_argument("--dry-run", action="store_true", help="measure and print, send nothing")
    args = ap.parse_args()

    print("plan-then-cull -- audience benchmark\n")

    models = list_models()
    if not models:
        print("No Ollama server found at 127.0.0.1:11434, or no models pulled.")
        print("  start it:  ollama serve")
        print("  get one:   ollama pull qwen3:0.6b     (522 MB, the one we used)")
        return 1

    model = args.model
    if not model:
        # Smallest first: the point is small models, and it keeps the bench short.
        sized = [(model_size_b(m) or 99, m) for m in models]
        model = sorted(sized)[0][1]
    if model not in models:
        print(f"'{model}' not found. You have: {', '.join(models)}")
        return 1

    name = args.name
    if not name:
        try:
            name = input("Display name for the leaderboard: ").strip() or "anonymous"
        except (EOFError, KeyboardInterrupt):
            name = "anonymous"

    print(f"\nmodel   {model}")
    print(f"machine {platform.system()} {platform.machine()}")
    print(f"width   {args.width}\n")

    print("warming up...", flush=True)
    try:
        generate(model, 0)
    except (urllib.error.URLError, OSError) as e:
        print(f"generation failed: {e}")
        return 1

    print(f"measuring ({args.width} sequential, then {args.width} concurrent)...", flush=True)
    r = measure(model, args.width)

    cands = round(r["con_tok_s"] * ROUND_SECONDS / NUM_PREDICT)
    print("\n" + "=" * 46)
    print(f"  {cands} candidates per 30s")
    print(f"  {r['con_tok_s']:.1f} tok/s concurrent")
    print(f"  {r['speedup']:.2f}x concurrency ceiling")
    print("=" * 46)
    if r["speedup"] < 1.2:
        print("\n  Your server is SERIALIZING -- asking for many at once buys")
        print("  nothing. If you run Ollama, try:  OLLAMA_NUM_PARALLEL=8 ollama serve")

    try:
        resp = send_payload(r, name, model, args.dry_run)
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        print(f"\ncouldn't post to the leaderboard: {e}")
        print("your numbers above are still valid.")
        return 0

    if resp:
        print(f"\nposted. rank #{resp.get('rank', '?')} of {resp.get('total', '?')}")
        print(f"live board: {BOARD}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
