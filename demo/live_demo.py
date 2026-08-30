#!/usr/bin/env python3
"""Run the Sundai 138 plan-then-cull stage demo.

The audience joins from the public webpage. Each join adds one candidate to
the search width on this machine; audience phones do not run a model. A local
qwen3:8b writes check(answer) once, its checker is tested before use, and
qwen3:0.6b proposes routes through a toy lunar surface mesh. CPython culls
every route that breaks a hard constraint.

Stdlib only. Nothing is trained and no API key is used.

Examples:
    python3 demo/live_demo.py --warmup-only
    python3 demo/live_demo.py
    python3 demo/live_demo.py --join-seconds 0 --dry-run
"""

from __future__ import annotations

import argparse
import ast
import builtins
import itertools
import json
from pathlib import Path
import sys
import time
import urllib.error
import urllib.request
import uuid
from collections import Counter
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait


SITE = "https://plan-then-cull.wilson-af8.workers.dev"
OLLAMA = "http://127.0.0.1:11434"
FOLLOWER_MODEL = "qwen3:0.6b"
PLANNER_MODEL = "qwen3:8b"
CHALLENGE_ID = "lunar-route-v1"
NODES = ("BASE", "A", "B", "C", "D", "E", "ROVER")
OFFLINE_NODE = "C"
MAX_LATENCY_MS = 9
MIN_BANDWIDTH_MBPS = 3
HEARTBEAT_SECONDS = 5

# Undirected links: (endpoint, endpoint) -> (latency_ms, bandwidth_mbps).
LINKS = {
    frozenset(("BASE", "A")): (2, 4),
    frozenset(("BASE", "B")): (3, 5),
    frozenset(("A", "C")): (2, 4),
    frozenset(("A", "D")): (4, 3),
    frozenset(("B", "D")): (2, 4),
    # Fast but low-bandwidth: this makes the bandwidth predicate meaningful.
    frozenset(("B", "E")): (2, 2),
    frozenset(("D", "E")): (1, 3),
    frozenset(("D", "ROVER")): (4, 3),
    frozenset(("E", "ROVER")): (2, 4),
    frozenset(("C", "ROVER")): (1, 5),
}

FOLLOWER_PROMPT = """A lunar surface mesh lost relay C. Find a route from BASE to ROVER. Links are undirected and shown as endpoint-endpoint(latency_ms, bandwidth_Mbps): BASE-A(2,4), BASE-B(3,5), A-C(2,4), A-D(4,3), B-D(2,4), B-E(2,2), D-E(1,3), D-ROVER(4,3), E-ROVER(2,4), C-ROVER(1,5). Requirements: never use offline node C; every consecutive pair must be a listed link; do not repeat nodes; total latency must be at most 9 ms; minimum bandwidth along the route must be at least 3 Mbps. Return JSON only: {"route":["BASE","...","ROVER"]}"""

PLANNER_PROMPT = """/no_think
Write one Python function named check(answer) for the task below. answer is already a Python dict. Return True only for a valid answer.

A lunar surface mesh lost relay C. Find a route from BASE to ROVER.
Undirected links are endpoint-endpoint(latency_ms, bandwidth_Mbps):
BASE-A(2,4), BASE-B(3,5), A-C(2,4), A-D(4,3), B-D(2,4), B-E(2,2), D-E(1,3), D-ROVER(4,3), E-ROVER(2,4), C-ROVER(1,5).

The answer must be a dict with exactly one key, route. route must be a list of node-name strings. Implement this algorithm explicitly:
1. Reject unless answer is a dict and set(answer.keys()) equals {"route"}.
2. Reject unless route is a list with at least two strings, route[0] equals "BASE", and route[-1] equals "ROVER". Do not replace the endpoint checks with membership checks.
3. Reject if any node is unknown, if "C" appears anywhere, or if len(route) differs from len(set(route)).
4. Store every undirected link and its (latency, bandwidth). For every consecutive pair, reject if the link is absent; otherwise ADD its latency to one total and collect its bandwidth.
5. Reject if the FINAL summed latency is greater than 9 or the minimum collected bandwidth is less than 3. Do not compare each link latency to 9; the constraint is on the sum.
6. Return True only after every check passes.

Your checker must reject all of these: reversed ROVER-to-BASE routes; any route through C; BASE-A-D-ROVER because its summed latency is 10; BASE-B-E-ROVER because its bottleneck is 2; routes with repeated nodes; unlisted hops; extra dictionary keys; and malformed shapes.

Use no imports, eval, exec, file or network access, exceptions, classes, global state, or recursion. Output only the function source with no markdown."""

OUTPUT_FORMAT = {
    "type": "object",
    "properties": {
        "route": {
            "type": "array",
            "minItems": 2,
            "maxItems": 7,
            "items": {"type": "string", "enum": list(NODES)},
        }
    },
    "required": ["route"],
    "additionalProperties": False,
}

GOOD_PROBE = {"route": ["BASE", "B", "D", "E", "ROVER"]}
BAD_PROBES = (
    {"route": ["BASE", "A", "C", "ROVER"]},  # offline C
    {"route": ["BASE", "A", "D", "ROVER"]},  # 10 ms
    {"route": ["BASE", "B", "E", "ROVER"]},  # only 2 Mbps
    {"route": ["BASE", "A", "E", "ROVER"]},  # A-E is not a link
    {"route": ["BASE", "B", "D", "B", "D", "ROVER"]},  # repeats
    {"route": ["ROVER", "E", "D", "B", "BASE"]},  # reversed
    {"route": ["BASE", "B", "D", "ROVER"], "extra": True},
)

REJECTION_KEYS = (
    "invalid_json",
    "wrong_shape",
    "bad_endpoints",
    "unknown_node",
    "repeated_node",
    "offline_node",
    "bad_hop",
    "latency",
    "bandwidth",
)


def request_json(url, payload=None, headers=None, timeout=180):
    request_headers = {"User-Agent": "plan-then-cull-live/1.0"}
    if headers:
        request_headers.update(headers)
    data = None
    if payload is not None:
        data = json.dumps(payload, separators=(",", ":")).encode()
        request_headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=request_headers)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read())


def ollama_generate(model, prompt, *, seed, num_predict, temperature, output_format=None):
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "think": False,
        "keep_alive": "1h",
        "options": {
            "temperature": temperature,
            "seed": seed,
            "num_predict": num_predict,
        },
    }
    if output_format is not None:
        payload["format"] = output_format
    started = time.perf_counter()
    result = request_json(f"{OLLAMA}/api/generate", payload, timeout=300)
    return {
        "text": result.get("response", "").strip(),
        "elapsed_s": time.perf_counter() - started,
        "eval_count": result.get("eval_count", 0),
        "load_ms": result.get("load_duration", 0) / 1_000_000,
    }


def list_models():
    result = request_json(f"{OLLAMA}/api/tags", timeout=10)
    return {model.get("name") for model in result.get("models", [])}


def warm_models(planner_model, follower_model):
    print("warming local models (this happens before the audience countdown)...", flush=True)
    for model in (planner_model, follower_model):
        result = ollama_generate(
            model,
            "/no_think\nReply with OK.",
            seed=138,
            num_predict=2,
            temperature=0,
        )
        print(f"  {model:<12} ready in {result['elapsed_s']:.1f}s", flush=True)


def reference_verdict(answer):
    """Return (reason, metrics); 'pass' is the only accepting reason."""
    if not isinstance(answer, dict) or set(answer) != {"route"}:
        return "wrong_shape", None
    route = answer.get("route")
    if not isinstance(route, list) or len(route) < 2 or not all(isinstance(node, str) for node in route):
        return "wrong_shape", None
    if route[0] != "BASE" or route[-1] != "ROVER":
        return "bad_endpoints", None
    if any(node not in NODES for node in route):
        return "unknown_node", None
    if len(set(route)) != len(route):
        return "repeated_node", None
    if OFFLINE_NODE in route:
        return "offline_node", None

    latency = 0
    bandwidths = []
    for left, right in zip(route, route[1:]):
        link = LINKS.get(frozenset((left, right)))
        if link is None:
            return "bad_hop", None
        latency += link[0]
        bandwidths.append(link[1])

    bandwidth = min(bandwidths) if bandwidths else 0
    if latency > MAX_LATENCY_MS:
        return "latency", {"latency_ms": latency, "bandwidth_mbps": bandwidth}
    if bandwidth < MIN_BANDWIDTH_MBPS:
        return "bandwidth", {"latency_ms": latency, "bandwidth_mbps": bandwidth}
    return "pass", {"latency_ms": latency, "bandwidth_mbps": bandwidth}


def extract_python_source(text):
    source = text.strip()
    marker = source.find("def check")
    if marker < 0:
        raise ValueError("planner did not return def check")
    source = source[marker:]
    fence = source.find("```")
    if fence >= 0:
        source = source[:fence]
    return source.strip()


SAFE_CALLS = {
    "all", "any", "dict", "enumerate", "float", "isinstance", "len", "list",
    "max", "min", "range", "set", "sum", "tuple", "zip",
}
SAFE_METHODS = {"count", "get", "items", "keys", "values"}
FORBIDDEN_AST = (
    ast.AsyncFunctionDef,
    ast.Await,
    ast.ClassDef,
    ast.Delete,
    ast.Global,
    ast.Import,
    ast.ImportFrom,
    ast.Lambda,
    ast.Nonlocal,
    ast.Raise,
    ast.Try,
    ast.While,
    ast.With,
    ast.Yield,
    ast.YieldFrom,
)


def compile_checker(source):
    if len(source) > 6000:
        raise ValueError("checker source is too large")
    tree = ast.parse(source, mode="exec")
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.FunctionDef):
        raise ValueError("checker must contain exactly one function")
    function = tree.body[0]
    if function.name != "check" or len(function.args.args) != 1 or function.decorator_list:
        raise ValueError("checker signature must be check(answer)")
    nodes = list(ast.walk(tree))
    if len(nodes) > 600:
        raise ValueError("checker AST is too large")
    for node in nodes:
        if isinstance(node, FORBIDDEN_AST):
            raise ValueError(f"forbidden checker syntax: {type(node).__name__}")
        if isinstance(node, ast.Name) and node.id.startswith("__"):
            raise ValueError("dunder names are forbidden")
        if isinstance(node, ast.Attribute):
            if node.attr.startswith("_") or node.attr not in SAFE_METHODS:
                raise ValueError(f"forbidden checker attribute: {node.attr}")
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name):
                if node.func.id not in SAFE_CALLS:
                    raise ValueError(f"forbidden checker call: {node.func.id}")
            elif isinstance(node.func, ast.Attribute):
                if node.func.attr not in SAFE_METHODS:
                    raise ValueError(f"forbidden checker method: {node.func.attr}")
            else:
                raise ValueError("indirect checker calls are forbidden")

    safe_builtins = {name: getattr(builtins, name) for name in SAFE_CALLS}
    namespace = {"__builtins__": safe_builtins}
    exec(compile(tree, "<planner-checker>", "exec"), namespace, namespace)
    checker = namespace.get("check")
    if not callable(checker):
        raise ValueError("check is not callable")
    return checker


def all_simple_route_answers():
    middle = ("A", "B", "C", "D", "E")
    yield {"route": ["BASE", "ROVER"]}
    for count in range(1, len(middle) + 1):
        for path in itertools.permutations(middle, count):
            yield {"route": ["BASE", *path, "ROVER"]}


def validate_checker(checker):
    good_ok = checker(GOOD_PROBE) is True
    bad_ok = all(checker(probe) is False for probe in BAD_PROBES)
    compared = 0
    for answer in all_simple_route_answers():
        expected = reference_verdict(answer)[0] == "pass"
        actual = checker(answer)
        if not isinstance(actual, bool) or actual != expected:
            raise ValueError(f"checker disagreed with probe {answer}")
        compared += 1
    if not good_ok or not bad_ok:
        raise ValueError("known-good or known-bad checker probe failed")
    return {"good_probe": good_ok, "bad_probe": bad_ok, "compared": compared}


def parse_candidate(text):
    try:
        return json.loads(text), None
    except (json.JSONDecodeError, TypeError):
        return None, "invalid_json"


def generate_candidate(model, seed):
    result = ollama_generate(
        model,
        FOLLOWER_PROMPT,
        seed=seed,
        num_predict=128,
        temperature=0.95,
        output_format="json",
    )
    answer, parse_error = parse_candidate(result["text"])
    return {
        "seed": seed,
        "raw": result["text"],
        "answer": answer,
        "parse_error": parse_error,
        "elapsed_s": result["elapsed_s"],
        "eval_count": result["eval_count"],
    }


class Reporter:
    def __init__(self, base_url, token, run_id, *, dry_run=False):
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.run_id = run_id
        self.dry_run = dry_run
        # The LiveRoom contract requires the first update for a new run to be 0.
        self.seq = -1
        self.state = {}

    def post(self, *, required=False, **changes):
        self.seq += 1
        self.state.update(changes)
        payload = {
            "run_id": self.run_id,
            "seq": self.seq,
            "challenge_id": CHALLENGE_ID,
            **self.state,
        }
        if self.dry_run:
            return {"ok": True, "dry_run": True}
        try:
            return request_json(
                f"{self.base_url}/api/live/run",
                payload,
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=30,
            )
        except (OSError, urllib.error.URLError, urllib.error.HTTPError) as error:
            if required:
                raise
            print(f"  dashboard update warning: {error}", file=sys.stderr, flush=True)
            return None

    def snapshot(self):
        if self.dry_run:
            return {
                "audience": {"joined": 0},
                "run": {"candidate_target": self.state.get("candidate_target", 0)},
            }
        return request_json(f"{self.base_url}/api/live", timeout=30)


def read_token(path):
    token_path = Path(path).expanduser().resolve()
    token = token_path.read_text(encoding="utf-8").strip()
    if not token:
        raise ValueError(f"empty ingest token: {token_path}")
    mode = token_path.stat().st_mode & 0o777
    if mode & 0o077:
        print(f"warning: {token_path} permissions are {mode:o}; use chmod 600", file=sys.stderr)
    return token


def initial_state(args, started):
    return {
        "status": "collecting",
        "join_open": True,
        "base_attempts": args.base_attempts,
        # While joins are open, candidate_target declares the room's real cap.
        # The LiveRoom only accepts candidate_target - base_attempts people, so
        # every accepted join can become exactly one candidate on this host.
        "candidate_target": args.max_attempts,
        "generated": 0,
        "checked": 0,
        "culled": 0,
        "survived": 0,
        "elapsed_ms": int((time.perf_counter() - started) * 1000),
        "model": args.model,
        "planner_model": args.planner_model,
        "checker": {
            "known_good_passed": False,
            "known_bad_rejected": False,
            "locked": False,
            "source_preview": "",
        },
        "rejection_counts": {key: 0 for key in REJECTION_KEYS},
        "result": None,
        "message": "Join now. Each person adds one candidate on the host Mac.",
    }


def run(args):
    try:
        models = list_models()
    except (OSError, urllib.error.URLError) as error:
        print(f"Ollama is not reachable at {OLLAMA}: {error}", file=sys.stderr)
        return 1
    missing = [model for model in (args.planner_model, args.model) if model not in models]
    if missing:
        print("missing Ollama model(s): " + ", ".join(missing), file=sys.stderr)
        print("pull them before the demo with: ollama pull MODEL", file=sys.stderr)
        return 1

    if not args.no_warmup:
        warm_models(args.planner_model, args.model)
    if args.warmup_only:
        print("warmup complete")
        return 0

    token = "dry-run"
    if not args.dry_run:
        try:
            token = read_token(args.token_file)
        except (OSError, ValueError) as error:
            print(str(error), file=sys.stderr)
            return 1

    started = time.perf_counter()
    run_id = time.strftime("%Y%m%dT%H%M%S") + "-" + uuid.uuid4().hex[:8]
    reporter = Reporter(args.base_url, token, run_id, dry_run=args.dry_run)
    reporter.state = initial_state(args, started)
    try:
        reporter.post(required=True)
    except (OSError, ValueError, urllib.error.URLError, urllib.error.HTTPError) as error:
        print(f"Could not open the audience room at {args.base_url}: {error}", file=sys.stderr)
        return 1

    last_count = 0
    if args.join_seconds:
        print(f"\njoin window open for {args.join_seconds}s", flush=True)
        deadline = time.monotonic() + args.join_seconds
        next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
        while time.monotonic() < deadline:
            try:
                joined = int(reporter.snapshot().get("audience", {}).get("joined", 0))
            except (OSError, TypeError, ValueError, urllib.error.URLError, urllib.error.HTTPError):
                joined = last_count or 0
            if joined != last_count:
                print(f"  audience joined: {joined}", flush=True)
                last_count = joined
            if time.monotonic() >= next_heartbeat:
                reporter.post(
                    status="collecting",
                    join_open=True,
                    elapsed_ms=int((time.perf_counter() - started) * 1000),
                    message="Join now. Each person adds one candidate on the host Mac.",
                )
                next_heartbeat = time.monotonic() + HEARTBEAT_SECONDS
            remaining = max(0, int(deadline - time.monotonic()))
            print(f"  starting in {remaining:>2}s", end="\r", flush=True)
            time.sleep(1)
        print(" " * 40, end="\r")

    try:
        snapshot = reporter.snapshot()
        joined = int(snapshot.get("audience", {}).get("joined", 0))
    except (OSError, TypeError, ValueError, urllib.error.URLError, urllib.error.HTTPError) as error:
        joined = last_count or 0
        print(
            f"  audience count warning: {error}; continuing with {joined}",
            file=sys.stderr,
            flush=True,
        )
    target = min(args.max_attempts, args.base_attempts + joined)
    print(f"audience {joined} + base {args.base_attempts} = {target} candidates", flush=True)
    compute_started = time.perf_counter()

    reporter.post(
        status="planning",
        join_open=False,
        candidate_target=target,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
        message=f"{args.planner_model} is writing check(answer) once.",
    )

    planning_started = time.perf_counter()
    try:
        with ThreadPoolExecutor(max_workers=1) as planner_pool:
            planner_future = planner_pool.submit(
                ollama_generate,
                args.planner_model,
                PLANNER_PROMPT,
                seed=138,
                num_predict=900,
                temperature=0,
            )
            while not planner_future.done():
                done, _ = wait((planner_future,), timeout=HEARTBEAT_SECONDS)
                if not done:
                    reporter.post(
                        status="planning",
                        elapsed_ms=int((time.perf_counter() - started) * 1000),
                        message=f"{args.planner_model} is still writing and validating check(answer).",
                    )
            planner = planner_future.result()
        source = extract_python_source(planner["text"])
        checker = compile_checker(source)
        probe = validate_checker(checker)
    except Exception as error:
        reporter.post(
            # collapse is reserved for a validated checker that culls the
            # entire candidate pool. A checker that never locks is an error.
            status="error",
            join_open=False,
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            message=f"Checker rejected; failed closed: {str(error)[:100]}",
        )
        print(f"checker validation failed closed: {error}", file=sys.stderr)
        return 2
    planning_elapsed_s = time.perf_counter() - planning_started

    checker_state = {
        "known_good_passed": True,
        "known_bad_rejected": True,
        "locked": True,
        "source_preview": source[:2000],
    }
    probe_count = probe["compared"] + 1 + len(BAD_PROBES)
    print(
        f"checker locked in {planning_elapsed_s:.1f}s: "
        f"good accepted, bad rejected, {probe_count} probes",
        flush=True,
    )
    reporter.post(
        status="sampling",
        checker=checker_state,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
        message=(
            f"Checker locked after {probe_count} probes. "
            f"{args.model} is generating {target} routes."
        ),
    )

    candidates = []
    generation_errors = []
    progress_every = max(2, target // 10)
    sampling_started = time.perf_counter()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = {
            pool.submit(generate_candidate, args.model, seed)
            for seed in range(target)
        }
        completed = 0
        next_progress = progress_every
        while pending:
            done, pending = wait(
                pending,
                timeout=HEARTBEAT_SECONDS,
                return_when=FIRST_COMPLETED,
            )
            if not done:
                reporter.post(
                    status="sampling",
                    generated=len(candidates),
                    elapsed_ms=int((time.perf_counter() - started) * 1000),
                    message=(
                        f"{args.model} is still generating: {len(candidates)} of {target} routes"
                        + (f" ({len(generation_errors)} request errors)." if generation_errors else ".")
                    ),
                )
                continue
            for future in done:
                try:
                    candidates.append(future.result())
                except Exception as error:
                    generation_errors.append(error)
            completed += len(done)
            if completed >= next_progress or not pending:
                reporter.post(
                    status="sampling",
                    # A failed request did not generate a candidate. Never
                    # inflate this count merely because its future completed.
                    generated=len(candidates),
                    elapsed_ms=int((time.perf_counter() - started) * 1000),
                    message=(
                        f"Pulled {len(candidates)} of {target} candidate routes"
                        + (f" ({len(generation_errors)} request errors)." if generation_errors else ".")
                    ),
                )
                while next_progress <= completed:
                    next_progress += progress_every

    sampling_elapsed_s = time.perf_counter() - sampling_started
    if generation_errors:
        first_error = str(generation_errors[0]).replace("\x00", " ")[:100]
        reporter.post(
            status="error",
            generated=len(candidates),
            checked=0,
            culled=0,
            survived=0,
            rejection_counts={key: 0 for key in REJECTION_KEYS},
            elapsed_ms=int((time.perf_counter() - started) * 1000),
            message=(
                f"Candidate generation failed closed after {len(candidates)} of {target}: "
                f"{first_error}"
            ),
        )
        print(
            f"candidate generation failed closed after {len(candidates)} of {target}: "
            f"{generation_errors[0]}",
            file=sys.stderr,
        )
        return 2

    print(f"generated {target} candidates in {sampling_elapsed_s:.1f}s", flush=True)
    reporter.post(
        status="checking",
        generated=target,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
        message="CPython is cross-checking every candidate against the locked constraints.",
    )

    rejection_counts = Counter({key: 0 for key in REJECTION_KEYS})
    survivors = []
    checking_started = time.perf_counter()
    for candidate_number, candidate in enumerate(candidates, start=1):
        if candidate["parse_error"]:
            rejection_counts[candidate["parse_error"]] += 1
            continue
        answer = candidate["answer"]
        reason, metrics = reference_verdict(answer)
        try:
            generated_accepts = checker(answer) is True
        except Exception:
            generated_accepts = False
        reference_accepts = reason == "pass"
        if generated_accepts != reference_accepts:
            rejected_so_far = sum(rejection_counts.values())
            reporter.post(
                # This candidate cannot honestly be classified as a cull or
                # survivor. Report only the prefix checked before it and stop.
                status="error",
                checked=rejected_so_far + len(survivors),
                culled=rejected_so_far,
                survived=len(survivors),
                rejection_counts=dict(rejection_counts),
                elapsed_ms=int((time.perf_counter() - started) * 1000),
                message=(
                    f"Checker disagreement on candidate {candidate_number}; "
                    "the run was discarded and failed closed."
                ),
            )
            print(
                f"checker disagreement on candidate {candidate_number}; failed closed",
                file=sys.stderr,
            )
            return 2
        if not reference_accepts:
            rejection_counts[reason] += 1
            continue
        survivors.append({"answer": answer, "metrics": metrics, "seed": candidate["seed"]})

    checking_elapsed_s = time.perf_counter() - checking_started
    elapsed_ms = int((time.perf_counter() - started) * 1000)
    compute_elapsed_s = time.perf_counter() - compute_started
    culled = target - len(survivors)
    if not survivors:
        reporter.post(
            status="collapse",
            generated=target,
            checked=target,
            culled=culled,
            survived=0,
            rejection_counts=dict(rejection_counts),
            elapsed_ms=elapsed_ms,
            message="No route survived. The system failed closed.",
        )
        print("COLLAPSE: no candidate survived", flush=True)
        return 3

    winner = min(
        survivors,
        key=lambda item: (item["metrics"]["latency_ms"], -item["metrics"]["bandwidth_mbps"], item["seed"]),
    )
    result = {
        "route": winner["answer"]["route"],
        "latency_ms": winner["metrics"]["latency_ms"],
        "bandwidth_mbps": winner["metrics"]["bandwidth_mbps"],
    }
    reporter.post(
        status="success",
        generated=target,
        checked=target,
        culled=culled,
        survived=len(survivors),
        rejection_counts=dict(rejection_counts),
        result=result,
        elapsed_ms=elapsed_ms,
        message=(
            f"Verified route found in {compute_elapsed_s:.1f}s after joins closed. "
            "Weights never changed."
        ),
    )

    print("\nSUCCESS")
    print(f"  generated  {target}")
    print(f"  culled     {culled}")
    print(f"  survived   {len(survivors)}")
    print(f"  route      {' -> '.join(result['route'])}")
    print(f"  latency    {result['latency_ms']} ms")
    print(f"  bandwidth  {result['bandwidth_mbps']} Mbps")
    print(
        f"  compute    {compute_elapsed_s:.1f} s "
        f"(plan {planning_elapsed_s:.1f} + sample {sampling_elapsed_s:.1f} "
        f"+ check {checking_elapsed_s:.1f})"
    )
    print(f"  live run   {elapsed_ms / 1000:.1f} s (warm-up excluded; join window included)")
    print(f"  dashboard  {args.base_url}")
    return 0


def parse_args():
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=SITE, help="dashboard base URL")
    parser.add_argument("--token-file", default=str(repo_root / ".ingest-token"))
    parser.add_argument("--model", default=FOLLOWER_MODEL)
    parser.add_argument("--planner-model", default=PLANNER_MODEL)
    parser.add_argument("--base-attempts", type=int, default=30)
    parser.add_argument("--max-attempts", type=int, default=100)
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--join-seconds", type=int, default=20)
    parser.add_argument("--no-warmup", action="store_true")
    parser.add_argument("--warmup-only", action="store_true")
    parser.add_argument("--dry-run", action="store_true", help="run locally without posting")
    args = parser.parse_args()
    if not 1 <= args.base_attempts <= 100:
        parser.error("--base-attempts must be 1..100")
    if not args.base_attempts <= args.max_attempts <= 100:
        parser.error("--max-attempts must be between base attempts and 100")
    if not 1 <= args.workers <= 16:
        parser.error("--workers must be 1..16")
    if not 0 <= args.join_seconds <= 120:
        parser.error("--join-seconds must be 0..120")
    return args


if __name__ == "__main__":
    sys.exit(run(parse_args()))
