# plan-then-cull

**A big model writes the test once. A tiny model tries many answers. Python culls the failures.**

Built for [Sundai Hack 138 — *Beyond Scale: Small Models, Big Applications*](https://www.sundai.club/) (MIT, 30 Aug 2026). The organizers set one challenge: **make a small model smarter, not bigger.** This repo contains a working live demonstration, its verifier tests, and the measurements behind its design.

**Live:** https://plan-then-cull.wilson-af8.workers.dev

MIT licensed. All model inference runs locally on one laptop with no model API key. The optional audience dashboard uses the public web app and therefore needs internet access.

---

## Run the participatory lunar-route demo

The live use case is a deliberately small, checkable routing problem. A toy lunar surface mesh has lost relay `C`; the system must find a route from `BASE` to `ROVER` using only real links, without repeated or offline nodes, with at most 9 ms total latency and at least 3 Mbps bottleneck bandwidth.

`qwen3:8b` writes `check(answer)` once. Before that checker can grade anything, the runner locks it down with an AST gate, a known-good route, seven known-bad routes, and a comparison against all 326 possible simple `BASE`-to-`ROVER` paths in this graph. If those checks disagree, the demo fails closed. Then `qwen3:0.6b` proposes many routes and CPython executes the locked checker on every candidate. The public page shows the pull, rejection reasons, cull count, survivors, and winning verified route as they happen.

### What the audience contributes

Open the [live dashboard](https://plan-then-cull.wilson-af8.workers.dev/#live-demo) and press **Add one candidate** during the join window. Each distinct participant adds **one candidate to the search running on the host Mac**: 30 base attempts plus the audience count, capped at 100.

The phones do **not** download or run a language model, and audience members do not need Python, Ollama, an account, or a command line. Their clicks widen one shared local search. That keeps the stage demo reliable on venue Wi-Fi and makes the claim precise: participation contributes search width, not phone compute.

### Host setup and stage commands

Run these from the repository root. The public-dashboard run expects the same ingest secret configured on the Worker as a single line in `.ingest-token`; keep that file untracked and restrict it with `chmod 600 .ingest-token`. `--dry-run` does not need the token.

In the first terminal, start Ollama with parallel requests enabled (skip this if an Ollama server with that setting is already running):

```bash
OLLAMA_NUM_PARALLEL=8 ollama serve
```

In a second terminal, pull both models once:

```bash
ollama pull qwen3:8b
ollama pull qwen3:0.6b
```

Prewarm both models before going on stage:

```bash
python3 demo/live_demo.py --warmup-only
```

Then open the dashboard for the room and start the live round:

```bash
python3 demo/live_demo.py
```

The default join window is 20 seconds. With both models warm, allow roughly **25–40 seconds after that window closes**, or about **45–60 seconds from command to result**. In one 30-candidate rehearsal, 8 routes survived and the complete plan/check/sample/cull run took **27.8 seconds** after a zero-second join window; candidate sampling itself took **6.7 seconds**. A later public rehearsal took **37.8 seconds** with the same 8-survivor result. Local model timings vary substantially between runs, so treat those as stage-planning ranges, not a latency guarantee. A cold model load can add roughly 15 seconds, which is why prewarming matters.

For a rehearsal that neither opens the audience join window nor updates the public dashboard:

```bash
python3 demo/live_demo.py --join-seconds 0 --dry-run
```

This challenge is an **educational simulation**, not a flight system. Its graph, link latency, and bandwidth values are synthetic. It does not use NASA or ESA operational data, control hardware, route real communications, or make a safety decision. The point is to make small-model test-time search and executable verification visible—not to claim the demo is ready for lunar operations.

---

## The problem, explained from zero

Imagine you ask someone to write a sentence where **every word starts with the letter S**.

A very expensive, very smart person gets it right most of the time. A cheap, fast person gets it right *almost never* — they write a nice sentence and forget the rule halfway through.

The whole industry's answer to this has been: **hire the more expensive person.** Make the model bigger. That works, and it costs more every single time you ask.

But there is a second answer, and it is strange:

> Ask the cheap person **sixty times**, throw away every attempt that breaks the rule, and keep one that survives.

You don't need a smarter writer. You need **a lot of cheap attempts and a reliable way to check them.**

That is the entire idea. The rest of this repo is about the two words doing the real work: *a lot*, and *reliable*.

---

## What we're building on

The hack's challenge statement links to [an MIT News article](https://news.mit.edu/2025/enabling-small-language-models-solve-complex-reasoning-tasks-1212), which describes a paper called **DisCIPL** ([arXiv:2504.07081](https://arxiv.org/abs/2504.07081), COLM 2025).

DisCIPL splits the job across two models:

- A **Planner** (big, runs *once*) reads the task and writes a little program that can check an answer.
- A crowd of **Followers** (small, run *many times*) generate candidate answers. The program checks each one. Bad ones get thrown away. Survivors get copied and mutated. Repeat.

The headline result: a **1-billion-parameter** model went from **0.07 to 0.84** on constrained-generation tasks — beating GPT-4o, which is enormously larger.

The capability didn't come from the model. It came from **the structure around the model**.

![How plan-then-cull works](docs/mechanism.svg)

---

## The failure mode we close

Here is the loose thread we pulled on.

In DisCIPL, **the checking program is written by a model.** It's a good program, usually. But it is a guess produced by the same kind of system whose output it is grading. When it's wrong, it's wrong *quietly* — it approves an answer that breaks the rule, and nothing errors.

The paper says so itself: bugs in generated programs can *"yield incorrect outputs without triggering any errors."*

Merely executing a model-written checker does not prove that the checker encodes the right rules. A vacuous `check()` that always returns `True` is valid Python and still approves every bad answer. So our change is small and stubborn:

> **Do not trust the generated checker until it accepts a known-good answer and rejects known-bad answers. Then lock it and execute it, rather than asking another model to judge prose.**

For the live challenge, that gate also compares the generated checker with a hand-written reference across the graph's full finite route space. CPython then gives every candidate the same deterministic verdict. If validation fails or the two checkers ever disagree, the round fails closed.

This is the same principle as [`reasoning-over-recall`](https://github.com/wilsonwu-ai/reasoning-over-recall) — *execute, don't judge* — applied to the hack's own source material.

---

## Approaches we considered, and why we didn't pick them

We generated 21 candidate projects across seven framings, cut them to 8, and ran each past three adversarial reviewers (a build-timeline skeptic, a novelty skeptic, and a "does this land from the back row" skeptic). Seven of the eight were killed. Here is the honest board:

| Approach | The idea | Why not |
|---|---|---|
| **Grammar Gate** | Make a bad token literally unsamplable via constrained decoding | Ollama's MLX engine **silently ignores** the JSON-schema `format` parameter. The demo would have looked like it worked all night and proved nothing. |
| **Exchange Rate** | Measure how many verified samples of a 0.8B model equal one 4B model | An eval/leaderboard project. Sundai has shipped **five** of these in 2026 and ran a whole self-improving-evals hack six days before this one. Most-burned idea in the room. |
| **Browser Particle Room** | Every phone downloads a model and becomes compute for one particle of a shared search | Depends on compatible phone hardware, a large model download, and conference Wi-Fi. The shipped audience interaction keeps inference on the host and lets each click add one host-side candidate instead. |
| **Outvoted** | Replicate a result showing majority voting makes small models *worse* | A negative result is hard to show in two minutes, and the fix it proposed was unproven. |
| **Anytime Arena** | A model in a 60fps game loop with a deadline it can't miss | Strong visual. But a no-model baseline beats it at 0ms unless the decision unit is a multi-move plan, which doubles the build. |
| **Clean Room** | Private docs extracted in-browser with the wifi off | Real use case, but the demo is "nothing happens, securely." |
| **Fail Closed** | Ship the verifier as an MCP server that makes a big agent admit it's wrong | Good idea, wrong hack — it makes the *big* model better, and the brief says small. |
| **Locked Cart** | A local agent shops a real store while a malicious merchant hijacks it | Best demo in the set by far. But agentic commerce ran at this same venue **two weeks earlier** with four projects. Kept as the designated fallback. |

**Why we picked this one:**

1. **It answers the actual question.** The organizers linked a specific paper. Nobody at this venue has built it. Reading the assignment is a differentiator.
2. **The contribution fits in one sentence.** *"The model writes the checker once; we challenge it before we lock it, then let CPython apply it consistently at search scale."*
3. **It routes around every runtime bug we found** (see below) — as long as culling happens in rounds rather than as true parallel Sequential Monte Carlo.
4. **The honest version was buildable in a day.** No LLaMPPL, no vLLM, no probabilistic-programming library. Plain Python.

---

## What we measured

Everything below was run on the target machine the night before the hack: **Apple M4 Max, 128 GB unified memory, Ollama 0.31.1**. Scripts are in [`experiments/`](experiments/), raw JSON alongside them. Stdlib only — no install step.

### 1. Concurrency: the server queues, it does not parallelize

The method wants many candidates at once. So the first question is whether asking for many at once actually helps.

| | wall clock |
|---|---|
| 8 requests, one after another | **5.0 s** |
| 8 requests, all at once | **5.1 s** |
| speedup | **0.98x** |

Zero benefit. This reproduces [ollama#17666](https://github.com/ollama/ollama/issues/17666) on 0.31.1. It does not error — it just queues, and the natural misreading is *"small models are slow"* rather than *"my server is single-threaded."*

Setting `OLLAMA_NUM_PARALLEL=8` helps, but nowhere near 8x. In the latest sweep:

| width | 1 | 4 | 8 | 16 |
|---|---|---|---|---|
| speedup (`qwen3:0.6b`) | 1.10x | 2.78x | 2.62x | **3.26x** |

**The best measured speedup is 3.26x at width 16.** The result is not monotonic and is still far below the requested concurrency, so plan the candidate budget around measurements rather than core count or `OLLAMA_NUM_PARALLEL` itself. These runs vary substantially; the ratios are more useful than any single timing.

### 2. `n > 1` is ignored

Asked the OpenAI-compatible endpoint for 4 samples. Got 1. Every candidate is its own round-trip, which is what makes finding #1 expensive rather than merely annoying.

### 3. Per-token logprobs *are* available — correcting our own research

We went in expecting logprobs to be unavailable on this path. **They're there**, with full `top_logprobs`:

```json
{"token": "Okay", "logprob": -0.000158,
 "top_logprobs": [{"token": "Okay", "logprob": -0.000158},
                  {"token": "Alright", "logprob": -8.76}]}
```

This matters: it means true SMC particle *weighting* is not blocked, only cheap parallelism is. We were wrong, we checked, and the plan got better. Recording it here because a corrected assumption is worth more than a confident one.

### 4. Why a small model, given a 128 GB machine

The obvious objection: this laptop can hold a 70B. Why not use it?

Because on fixed hardware, **candidates and parameters come out of the same budget** — and this method's gain comes from candidates.

| model | concurrent tok/s | parallelism ceiling | **candidates per 30s round** |
|---|---|---|---|
| `qwen3:0.6b` | **696.9** | 3.26x | **131** |
| `qwen3:1.7b` | 363.6 | 1.80x | 68 |
| `qwen3:8b` | 95.2 | 1.34x | **18** |

These candidate counts normalize throughput to 160 tokens per answer; they are capacity estimates, not a promise that every task finishes in exactly 30 seconds. **13x the parameters costs about 7x the width.** The bigger model is also penalized twice — its parallelism ceiling is *worse*, because decode is memory-bandwidth-bound and 128 GB of capacity does nothing about bandwidth.

So "small" here is not a constraint being tolerated. It is the correct engineering answer to *how do I afford sixty attempts.*

The honest use of 128 GB is different: it holds an **8B Planner and a 0.6B Follower resident at the same time**, so inference runs locally on one laptop with no model API key. Only the optional shared dashboard needs the network.

---

## What this is not

Stated up front, because conceding limits before anyone asks is the point.

- **We did not invent this.** The mechanism is DisCIPL's. Our contribution is the generated-checker validation gate and the live, measured implementation.
- **A round-based cull is not Sequential Monte Carlo.** Real SMC weights particles by conditional probability. We approximate with sequence-level pass/fail. Logprobs make the real thing *possible*, not *implemented*.
- **An interpreter is a correctness filter, not a security boundary.** A subprocess with a timeout stops mistakes, not attackers.
- **These numbers are Apple-platform-specific.** They were measured on one M4 Max. A 16 GB Mac does not even get the same Ollama backend. Compare checkpoints on one machine and say which.
- **DisCIPL does not beat o1 anywhere in the paper**, and loses to GPT-4o on paragraphs. Constraint satisfaction also costs measurable fluency. Do not read "1B beats GPT-4o" as a general claim — it is specific to constrained generation.

---

## Run it yourself

Start one Ollama server in the first terminal:

```bash
OLLAMA_NUM_PARALLEL=8 ollama serve
```

Then use a second terminal:

```bash
ollama pull qwen3:0.6b     # 522 MB
ollama pull qwen3:1.7b     # 1.4 GB
python3 experiments/runtime_probe.py --model qwen3:1.7b --n 8
python3 experiments/parallel_sweep.py --model qwen3:0.6b --widths 1,2,4,8,16
```

`runtime_probe.py` answers *"can this machine run a particle method at all?"* in about a minute.
`parallel_sweep.py` answers *"how wide can I go before it stops helping?"*

Run them before building anything that assumes parallel sampling works. That is the actual lesson: **verify a runtime by its measured side effect, never by the fact that a call returned.**

---

## Related work of ours

- [`reasoning-over-recall`](https://github.com/wilsonwu-ai/reasoning-over-recall) — why you'd train a small model to reason instead of memorize, plus an execution-based verifier for training data
- [`smoleval`](https://github.com/wilsonwu-ai/smoleval) — eval harness for small code models, sandboxed execution, unbiased pass@k
- [`vibe-silicon`](https://github.com/wilsonwu-ai/vibe-silicon) — Sundai Hack 135: a language model running on an $82 FPGA

## License

MIT — see [LICENSE](LICENSE). Contributions welcome.
