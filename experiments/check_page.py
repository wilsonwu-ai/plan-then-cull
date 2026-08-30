#!/usr/bin/env python3
"""Validate the page the BROWSER receives, not the source you edited.

`node --check src/worker.js` passes even when the page is dead, because the
page lives inside a JS template literal: a backslash in there is consumed
before the browser ever sees it, so a regex or an escape sequence arrives
mangled and the page's script dies silently while the HTML still renders.

This already shipped once on a previous project. Hence this file.

It fetches the deployed URL and asserts the served artifact is intact:
  - HTTP 200 and an HTML content-type
  - the script block is present and balanced
  - no stray backslashes survived into the served page
  - the elements the script reaches for actually exist
  - /health, /api/results and /api/round all answer

Stdlib only.

Usage:
    python3 experiments/check_page.py https://plan-then-cull.<subdomain>.workers.dev
"""

import json
import sys
import urllib.error
import urllib.request

UA = {"User-Agent": "plan-then-cull-check/1.0"}  # Cloudflare 1010s urllib's default


def get(url, expect_json=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode("utf-8", "replace")
        return r.status, r.headers.get("content-type", ""), (json.loads(body) if expect_json else body)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    base = sys.argv[1].rstrip("/")
    failures = []

    def check(name, ok, detail=""):
        print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  -- {detail}" if detail and not ok else ""))
        if not ok:
            failures.append(name)

    print(f"checking {base}")

    # --- the page itself ---
    try:
        status, ctype, html = get(base + "/")
    except (urllib.error.URLError, urllib.error.HTTPError, OSError) as e:
        print(f"  FAIL  page fetch -- {e}")
        return 1

    check("page returns 200", status == 200, str(status))
    check("page is html", "text/html" in ctype, ctype)
    check("page is non-trivial", len(html) > 2000, f"{len(html)} bytes")
    check("hero is Distillation", "<h1>Distillation</h1>" in html)
    check("hero defines pull and cull", "Part one: pull and cull." in html)

    openai_at = html.find("Start here &mdash; OpenAI Codex")
    problem_at = html.find("Why this matters &mdash; the problem")
    check(
        "OpenAI example comes first",
        openai_at >= 0 and problem_at >= 0 and openai_at < problem_at,
        f"OpenAI at {openai_at}, problem at {problem_at}",
    )

    # The trap: a backslash surviving into the served page means the template
    # literal mangled something. There should be exactly zero.
    n_backslash = html.count("\\")
    check("no stray backslashes in served page", n_backslash == 0, f"found {n_backslash}")

    check("script block present", "<script>" in html and "</script>" in html)
    check("script tags balanced", html.count("<script>") == html.count("</script>"))

    # Elements the inline script depends on. If the id is renamed in the CSS or
    # markup but not the script, the page renders and silently does nothing.
    for needle in ['id="live"', "getElementById('live')", "/api/round"]:
        check(f"page references {needle}", needle in html)

    # --- the API surface ---
    for path, key in (("/health", "ok"), ("/api/results", "exchange_rate")):
        try:
            status, ctype, data = get(base + path, expect_json=True)
            check(f"{path} returns 200 json", status == 200 and "json" in ctype)
            check(f"{path} has '{key}'", key in data)
        except Exception as e:
            check(f"{path} answers", False, str(e))

    try:
        status, ctype, data = get(base + "/api/round", expect_json=True)
        check("/api/round returns 200 json", status == 200 and "json" in ctype)
        check("/api/round is readable", isinstance(data, dict))
    except Exception as e:
        check("/api/round answers", False, str(e))

    # Ingest must reject an unauthenticated POST. A demo endpoint that accepts
    # anything is worse than no endpoint.
    try:
        req = urllib.request.Request(
            base + "/api/round", data=b"{}", headers={**UA, "Content-Type": "application/json"}
        )
        urllib.request.urlopen(req, timeout=30)
        check("unauthenticated POST is rejected", False, "it was accepted")
    except urllib.error.HTTPError as e:
        check("unauthenticated POST is rejected", e.code == 401, f"got {e.code}")
    except Exception as e:
        check("unauthenticated POST is rejected", False, str(e))

    print()
    if failures:
        print(f"{len(failures)} FAILED: {', '.join(failures)}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
