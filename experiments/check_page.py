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
  - all nine explanatory sections retain an accessible, captioned visual
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
from collections import Counter
from html.parser import HTMLParser

UA = {"User-Agent": "plan-then-cull-check/1.0"}  # Cloudflare 1010s urllib's default


EXPECTED_SECTION_VISUALS = [
    "openai-bars",
    "situation-constraint",
    "part-one-terminal",
    "measurements-cards",
    "distillation-pipeline",
    "qa-trust",
    "benchmark-flow",
    "live-round",
    "glossary-map",
]

EXPECTED_FIGURES = {
    "openai-visual": "openai-bars",
    "constraint-visual": "situation-constraint",
    "distillation-visual": "distillation-pipeline",
    "trust-visual": "qa-trust",
    "benchmark-visual": "benchmark-flow",
    "round-visual": "live-round",
    "glossary-visual": "glossary-map",
}

EXPECTED_FIGURE_LABELS = {
    "openai-visual": [
        "164",
        "37.7%",
        "44.5%",
        "77.5%",
        "oracle",
        "APPS",
        "1,000 attempts",
        "4.14%",
        "22.78%",
    ],
    "constraint-visual": ["five words", "begins with S", "glow", "FAIL"],
    "distillation-visual": ["Part one", "Part two", "60 attempts", "check()", "survivors", "Train"],
    "trust-visual": ["Big model", "Probe gate", "known-good", "known-bad", "Tiny model", "CPython"],
    "benchmark-visual": ["Ollama", "bench.py", "Worker", "Public board", "Sends", "Never sends"],
    "round-visual": ["Pull", "Check", "Keep", "Exit", "success", "budget", "collapse"],
    "glossary-visual": ["Attempt", "Width", "Cull", "Parameters", "Temperature", "CPython"],
}

LIVE_METRIC_IDS = ["roundGenerated", "roundChecked", "roundSurvived", "roundExit"]


class PageStructureParser(HTMLParser):
    """Collect the structural contracts that string searches cannot verify."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.section_stack = []
        self.section_visuals = []
        self.section_classes = {}
        self.ids = []
        self.figures = {}
        self.figure_stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            self.ids.append(element_id)

        if tag == "section":
            visual = attrs.get("data-visual")
            self.section_stack.append(visual)
            self.section_visuals.append(visual)
            if visual is not None:
                self.section_classes.setdefault(visual, set())

        current_section = self.section_stack[-1] if self.section_stack else None
        if current_section is not None:
            classes = attrs.get("class", "").split()
            self.section_classes.setdefault(current_section, set()).update(classes)

        if tag == "figure":
            figure = {
                "section": current_section,
                "classes": set(attrs.get("class", "").split()),
                "has_caption": False,
                "caption_ids": set(),
                "descendant_ids": set(),
                "aria-labelledby": attrs.get("aria-labelledby"),
                "text": [],
            }
            if element_id:
                self.figures[element_id] = figure
            self.figure_stack.append(figure)

        if self.figure_stack:
            figure = self.figure_stack[-1]
            if element_id:
                figure["descendant_ids"].add(element_id)
            if tag == "figcaption":
                figure["has_caption"] = True
                if element_id:
                    figure["caption_ids"].add(element_id)

    def handle_endtag(self, tag):
        if tag == "figure" and self.figure_stack:
            self.figure_stack.pop()
        if tag == "section" and self.section_stack:
            self.section_stack.pop()

    def handle_data(self, data):
        if self.figure_stack:
            self.figure_stack[-1]["text"].append(data)


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

    terminal_count = html.count('class="terminal-window"')
    check("two terminal diagrams are present", terminal_count == 2, f"found {terminal_count}")
    check("terminal transcript is labeled illustrative", "Illustrated run, not recorded output." in html)
    check(
        "terminal group is labeled",
        'class="terminal-grid" role="group" aria-label="Illustrative terminal transcript' in html,
    )
    check(
        "terminal validates the checker",
        "known-good &rarr; True" in html
        and "known-bad  &rarr; False" in html
        and "checker locked" in html,
    )
    check(
        "terminal shows the cull",
        "[CPython]" in html and "56 deleted" in html and "4 survived" in html,
    )
    check(
        "terminal shows every loop exit",
        "SUCCESS" in html and "budget" in html and "collapse fails closed" in html,
    )

    # Every explanatory section declares the visual that carries its idea.
    # Parse actual elements rather than accepting marker text in a comment or
    # script: these are contracts on the rendered document structure.
    structure = PageStructureParser()
    structure.feed(html)
    id_counts = Counter(structure.ids)

    check(
        "all nine sections declare their visual",
        structure.section_visuals == EXPECTED_SECTION_VISUALS,
        f"found {structure.section_visuals}",
    )
    duplicate_ids = sorted(element_id for element_id, count in id_counts.items() if count != 1)
    check("all element ids are unique", not duplicate_ids, f"duplicates: {duplicate_ids}")

    for figure_id, section_visual in EXPECTED_FIGURES.items():
        figure = structure.figures.get(figure_id)
        check(f"{figure_id} is a figure", figure is not None)
        if figure is None:
            continue
        check(
            f"{figure_id} is in {section_visual}",
            figure["section"] == section_visual,
            f"found in {figure['section']}",
        )
        check(f"{figure_id} has visual styling", "viz" in figure["classes"])
        check(f"{figure_id} has a caption", figure["has_caption"])

        label_ids = (figure["aria-labelledby"] or "").split()
        check(
            f"{figure_id} has title and description labels",
            len(label_ids) >= 2 and len(label_ids) == len(set(label_ids)),
            f"aria-labelledby: {figure['aria-labelledby']}",
        )

        missing_labels = [
            label_id
            for label_id in label_ids
            if label_id not in figure["descendant_ids"] or id_counts[label_id] != 1
        ]
        check(
            f"{figure_id} accessibility labels resolve",
            not missing_labels,
            f"missing or non-unique: {sorted(set(missing_labels))}",
        )
        check(
            f"{figure_id} description is its caption",
            bool(set(label_ids) & figure["caption_ids"]),
            f"caption ids: {sorted(figure['caption_ids'])}",
        )

        figure_text = " ".join(" ".join(figure["text"]).split()).lower()
        missing_facts = [
            label
            for label in EXPECTED_FIGURE_LABELS[figure_id]
            if label.lower() not in figure_text
        ]
        check(
            f"{figure_id} keeps its factual labels",
            not missing_facts,
            f"missing: {missing_facts}",
        )

    check(
        "part one keeps the terminal visual",
        "terminal-grid" in structure.section_classes.get("part-one-terminal", set()),
    )
    check(
        "measurements keep the number cards",
        "numbers" in structure.section_classes.get("measurements-cards", set()),
    )

    round_figure = structure.figures.get("round-visual")
    round_ids = round_figure["descendant_ids"] if round_figure else set()
    for metric_id in LIVE_METRIC_IDS:
        check(
            f"live visual contains {metric_id}",
            id_counts[metric_id] == 1 and metric_id in round_ids,
        )
        check(
            f"script updates {metric_id}",
            f"getElementById('{metric_id}')" in html,
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
