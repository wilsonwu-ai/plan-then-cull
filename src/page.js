/**
 * The public page, told as a story.
 *
 * Structure is STAR: Situation, then Task & Action together, then Result,
 * then a real-world case (not an analogy).
 *
 * Register: explain it to someone who knows nothing. Every technical term is
 * defined the first time it appears. Every number carries a "what this means"
 * line, because a number nobody can interpret is decoration.
 *
 * HARD RULE: no backslashes anywhere in this file's exported template string.
 * No regex literals, no escape sequences. A backslash inside a JS template
 * literal is consumed before the browser sees it, which silently kills the
 * page script while the HTML still renders. check_page.py enforces this
 * against the deployed URL.
 */

export const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>plan-then-cull</title>
<style>
  :root{
    --paper:#f5f5f5; --ink:#2d3142; --muted:#4f5d75; --soft:#7a8399;
    --accent:#eb6c36; --accent-tint:rgba(235,108,54,0.10);
    --rule:rgba(45,49,66,0.12); --card:#ffffff; --wash:rgba(45,49,66,0.04);
  }
  @media (prefers-color-scheme: dark){
    :root{
      --paper:#2d3142; --ink:#f5f5f5; --muted:#bfc0c0; --soft:#8e98ac;
      --accent:#f08a59; --accent-tint:rgba(240,138,89,0.14);
      --rule:rgba(245,245,245,0.14); --card:rgba(245,245,245,0.04); --wash:rgba(245,245,245,0.05);
    }
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--paper); color:var(--ink);
    font-family:'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    line-height:1.65; padding:2.5rem 1.5rem 5rem; font-size:17px;
  }
  .wrap{max-width:820px;margin:0 auto}
  .mono{font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace}
  .eyebrow{
    font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.7rem;
    letter-spacing:.18em; text-transform:uppercase; color:var(--soft); margin:0 0 .6rem;
  }
  h1{font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:3rem;
     margin:0 0 1rem; line-height:1.1; letter-spacing:-0.01em}
  .lede{font-size:1.2rem; color:var(--ink); margin:0 0 .75rem; line-height:1.5}
  .lede b{color:var(--accent); font-weight:600}
  .sub{color:var(--muted); margin:0 0 3rem; font-size:1rem}

  section{margin:0 0 3.5rem}
  .step-label{
    font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.68rem;
    letter-spacing:.18em; text-transform:uppercase; color:var(--accent);
    margin:0 0 .4rem; font-weight:600;
  }
  h2{font-family:'Instrument Serif',Georgia,serif; font-weight:400; font-size:2rem;
     margin:0 0 1rem; line-height:1.2}
  h3{font-size:1.05rem; font-weight:600; margin:2rem 0 .5rem}
  p{margin:0 0 1rem}
  .pull{
    border-left:3px solid var(--accent); padding:.25rem 0 .25rem 1.25rem;
    margin:1.5rem 0; font-size:1.1rem; color:var(--ink);
  }
  .note{
    background:var(--wash); border:1px solid var(--rule); border-radius:6px;
    padding:1rem 1.25rem; margin:1.5rem 0; font-size:.95rem; color:var(--muted);
  }
  .note b{color:var(--ink)}
  dfn{
    font-style:normal; font-weight:600; color:var(--ink);
    border-bottom:1px dotted var(--soft); cursor:help;
  }
  code{
    font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.88em;
    background:var(--wash); padding:.1em .4em; border-radius:3px; border:1px solid var(--rule);
  }

  figure{margin:2rem 0}
  figure svg{width:100%; height:auto; display:block}
  figcaption{font-size:.85rem; color:var(--soft); margin-top:.75rem; text-align:center}

  .numbers{display:grid; gap:1rem; margin:1.5rem 0}
  .num{
    background:var(--card); border:1px solid var(--rule); border-radius:6px;
    padding:1.25rem 1.5rem; display:grid; grid-template-columns:auto 1fr; gap:1.5rem; align-items:start;
  }
  .num .big{font-size:2.4rem; font-weight:600; letter-spacing:-0.02em; line-height:1; min-width:5.5rem}
  .num.focal{border-color:var(--accent)}
  .num.focal .big{color:var(--accent)}
  .num .what{font-weight:600; margin:0 0 .3rem; font-size:1rem}
  .num .means{color:var(--muted); font-size:.93rem; margin:0}

  table{width:100%; border-collapse:collapse; margin:1.5rem 0; font-size:.95rem}
  th,td{text-align:left; padding:.65rem .8rem; border-bottom:1px solid var(--rule)}
  th{font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.65rem;
     letter-spacing:.14em; text-transform:uppercase; color:var(--soft); font-weight:500}
  td.n{font-family:'Geist Mono',ui-monospace,Menlo,monospace; text-align:right}
  tr.focal td{color:var(--accent); font-weight:600}

  .live{
    background:var(--card); border:1px solid var(--rule); border-radius:6px; padding:1.25rem;
    font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.8rem; color:var(--muted);
    white-space:pre-wrap; word-break:break-word; min-height:3.5rem;
  }
  .glossary dt{font-weight:600; margin-top:1rem}
  .glossary dd{margin:.2rem 0 0; color:var(--muted)}
  footer{margin-top:4rem; padding-top:1.25rem; border-top:1px solid var(--rule);
         font-family:'Geist Mono',ui-monospace,Menlo,monospace; font-size:.72rem; color:var(--soft)}
  a{color:var(--accent)}
  .src{font-size:.82rem; color:var(--soft)}
  @media (max-width:600px){
    body{font-size:16px; padding:1.5rem 1.1rem 4rem}
    h1{font-size:2.2rem} h2{font-size:1.6rem}
    .num{grid-template-columns:1fr; gap:.5rem}
    .num .big{font-size:2rem}
  }
</style>
</head>
<body>
<div class="wrap">

  <p class="eyebrow">Sundai Hack 138 &middot; MIT &middot; 30 August 2026</p>
  <h1>plan-then-cull</h1>
  <p class="lede">A big model (<b>qwen3:8b</b>) writes a test, once.
  A tiny model (<b>qwen3:0.6b</b>) writes <b>sixty different attempts</b> at passing it.
  Then <b>CPython</b> &mdash; the ordinary Python interpreter &mdash; runs every attempt and
  deletes the ones that fail.</p>
  <p class="sub">Nothing here is a bigger model. The whole idea is to get a better answer out
  of a small one by giving it many tries and a grader that cannot be argued with.</p>

  <!-- ============================ SITUATION ============================ -->
  <section>
    <p class="step-label">Situation &mdash; the problem</p>
    <h2>Small models are cheap, fast, and wrong a lot</h2>

    <p>A <dfn title="A language model with few parameters, so it is cheap and fast but less capable">small language model</dfn>
    can write you a sentence in a fraction of a second on a laptop, for no money, with no
    internet. It is also wrong far more often than a large one.</p>

    <p>Take a task with a hard rule attached &mdash; write a sentence where every word starts
    with the letter S, or compute an answer that has to be exactly right. A small model will
    produce something fluent that quietly breaks the rule. It does not notice.</p>

    <p>For the last several years the industry's answer to this has been the same: use a
    bigger model. That works. It also costs more every single time you ask, needs a
    datacenter, and sends your data somewhere else.</p>

    <div class="pull">The question this project asks: <b>what creates capability besides
    scale?</b></div>

    <p class="src">That is the challenge statement that
    <a href="https://www.sundai.club/">Sundai Hack 138</a> set, and it points at
    <a href="https://arxiv.org/abs/2504.07081">a specific paper</a> for the answer.</p>
  </section>

  <!-- ========================= TASK &amp; ACTION ========================= -->
  <section>
    <p class="step-label">Task &amp; Action &mdash; what we set out to do, and what we did</p>
    <h2>Stop asking the model to be right. Ask it many times, and check.</h2>

    <p>If one attempt from a small model is unreliable, sixty attempts are sixty chances that
    <em>at least one</em> is correct. That is only useful if you can tell which one. So the
    real problem is not generation. It is <b>checking</b>.</p>

    <p>Here is the whole system, in three steps.</p>

    <figure>
    <svg viewBox="0 0 520 588" role="img" aria-labelledby="flow-title flow-desc">
      <title id="flow-title">The three steps of plan-then-cull</title>
      <desc id="flow-desc">Step one: a big model, qwen3 8b, writes a check function once.
      Step two: a tiny model, qwen3 0.6b, writes sixty different attempts at the answer.
      Step three: the CPython interpreter runs the check on every attempt and deletes the
      ones that fail. A few survivors remain, and the loop repeats with those until one
      passes.</desc>
      <defs>
        <marker id="fa" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="var(--soft)"/>
        </marker>
      </defs>

      <!-- connectors first, so boxes sit on top -->
      <line x1="260" y1="88"  x2="260" y2="112" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#fa)"/>
      <line x1="260" y1="232" x2="260" y2="256" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#fa)"/>
      <line x1="260" y1="376" x2="260" y2="400" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#fa)"/>
      <!-- loop: survivors go round again -->
      <path d="M 60 424 H 32 Q 24 424 24 416 V 160 Q 24 152 32 152 H 52"
            fill="none" stroke="var(--soft)" stroke-width="1.5" stroke-dasharray="5,4" marker-end="url(#fa)"/>
      <text x="16" y="292" fill="var(--soft)" font-size="10" text-anchor="middle"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace"
            transform="rotate(-90 16 292)">SURVIVORS GO AGAIN</text>

      <!-- STEP 1 -->
      <rect x="60" y="24" width="400" height="64" rx="6" fill="var(--card)" stroke="var(--rule)"/>
      <text x="76" y="46" fill="var(--accent)" font-size="10" font-weight="600"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" letter-spacing="1.4">STEP 1 &#183; RUNS ONCE</text>
      <text x="76" y="66" fill="var(--ink)" font-size="15" font-weight="600"
            font-family="'Geist',sans-serif">Big model writes the test</text>
      <text x="76" y="82" fill="var(--muted)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">qwen3:8b &#8594; check(answer) &#8594; true / false</text>

      <!-- STEP 2 -->
      <rect x="60" y="120" width="400" height="64" rx="6" fill="var(--card)" stroke="var(--rule)"/>
      <text x="76" y="142" fill="var(--accent)" font-size="10" font-weight="600"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" letter-spacing="1.4">STEP 2 &#183; RUNS SIXTY TIMES</text>
      <text x="76" y="162" fill="var(--ink)" font-size="15" font-weight="600"
            font-family="'Geist',sans-serif">Tiny model writes 60 attempts</text>
      <text x="76" y="178" fill="var(--muted)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">qwen3:0.6b &#183; temperature 0.8 &#183; all different</text>

      <!-- attempt tiles: 20 shown, standing in for 60 -->
      <g>
        <rect x="60" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="80" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="100" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="120" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="140" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="160" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="180" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="200" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="220" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="240" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="260" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="280" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="300" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="320" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="340" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="360" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="380" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="400" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="420" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
        <rect x="440" y="196" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)"/>
      </g>

      <!-- STEP 3 : focal -->
      <rect x="60" y="264" width="400" height="64" rx="6" fill="var(--accent-tint)" stroke="var(--accent)"/>
      <text x="76" y="286" fill="var(--accent)" font-size="10" font-weight="600"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" letter-spacing="1.4">STEP 3 &#183; THE GRADER</text>
      <text x="76" y="306" fill="var(--ink)" font-size="15" font-weight="600"
            font-family="'Geist',sans-serif">CPython runs check() on each one</text>
      <text x="76" y="322" fill="var(--muted)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">it executes &#183; it has no opinion &#183; it cannot be persuaded</text>

      <!-- graded tiles: 3 survive, 17 struck through -->
      <g>
        <rect x="60"  y="340" width="16" height="24" rx="2" fill="var(--accent-tint)" stroke="var(--accent)"/>
        <rect x="80"  y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="82" y1="343" x2="94" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="100" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="102" y1="343" x2="114" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="120" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="122" y1="343" x2="134" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="140" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="142" y1="343" x2="154" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="160" y="340" width="16" height="24" rx="2" fill="var(--accent-tint)" stroke="var(--accent)"/>
        <rect x="180" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="182" y1="343" x2="194" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="200" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="202" y1="343" x2="214" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="220" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="222" y1="343" x2="234" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="240" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="242" y1="343" x2="254" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="260" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="262" y1="343" x2="274" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="280" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="282" y1="343" x2="294" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="300" y="340" width="16" height="24" rx="2" fill="var(--accent-tint)" stroke="var(--accent)"/>
        <rect x="320" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="322" y1="343" x2="334" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="340" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="342" y1="343" x2="354" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="360" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="362" y1="343" x2="374" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="380" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="382" y1="343" x2="394" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="400" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="402" y1="343" x2="414" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="420" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="422" y1="343" x2="434" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
        <rect x="440" y="340" width="16" height="24" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.4"/>
        <line x1="442" y1="343" x2="454" y2="361" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
      </g>

      <!-- ANSWER -->
      <rect x="60" y="400" width="400" height="56" rx="6" fill="var(--card)" stroke="var(--rule)"/>
      <text x="76" y="424" fill="var(--ink)" font-size="15" font-weight="600"
            font-family="'Geist',sans-serif">An answer that provably passes</text>
      <text x="76" y="442" fill="var(--muted)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">not judged correct &#183; measured correct</text>

      <!-- legend -->
      <line x1="60" y1="500" x2="460" y2="500" stroke="var(--rule)" stroke-width="1"/>
      <rect x="60" y="516" width="12" height="16" rx="2" fill="var(--accent-tint)" stroke="var(--accent)"/>
      <text x="80" y="529" fill="var(--soft)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">passed the check</text>
      <rect x="220" y="516" width="12" height="16" rx="2" fill="var(--wash)" stroke="var(--rule)" opacity="0.5"/>
      <line x1="221" y1="518" x2="231" y2="530" stroke="var(--soft)" stroke-width="1.2" opacity="0.7"/>
      <text x="240" y="529" fill="var(--soft)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">deleted</text>
      <text x="352" y="529" fill="var(--soft)" font-size="11"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">20 of 60 shown</text>
    </svg>
    <figcaption>The expensive model runs once. The cheap model runs sixty times.
    The interpreter decides.</figcaption>
    </figure>

    <h3>Step 1 &mdash; The big model writes the test (runs once)</h3>
    <p><code>qwen3:8b</code> reads the task and writes a small Python function:
    <code>check(answer)</code>, which returns true or false. It does not answer the question.
    It writes the thing that decides whether an answer is acceptable. This happens
    <b>one time</b>, so the expensive model is a tiny part of the bill.</p>

    <h3>Step 2 &mdash; The tiny model writes sixty attempts</h3>
    <p><code>qwen3:0.6b</code> writes <b>sixty separate, different answers to the same
    question.</b> Not one answer sixty times slower &mdash; sixty distinct attempts. They
    differ because the model samples randomly
    (<dfn title="A setting that controls randomness. 0 gives the same answer every time; higher values give varied answers">temperature</dfn>
    is set to 0.8, so each run takes a different path).</p>

    <h3>Step 3 &mdash; A real interpreter grades them</h3>
    <p>Each attempt is passed to <b>CPython 3.12</b> &mdash; the standard <code>python3</code>
    that ships on any Mac or Linux box. The <code>check()</code> function actually runs.
    Attempts that return false are deleted. Survivors go around again.</p>

    <div class="note">
      <b>Why an interpreter instead of asking another model "is this right?"</b><br>
      Because a model that grades another model shares its blind spots, and it can be talked
      out of its answer by confident-sounding text. An interpreter has no opinion. It runs the
      code. The code either produces the right answer or it does not. There is nothing to
      persuade.
      <br><br>
      This is also the one thing here that differs from the paper we are building on. In
      <a href="https://arxiv.org/abs/2504.07081">DisCIPL</a>, the checking program is itself
      written by a model and is approximate. The paper says so: bugs in generated programs can
      <em>"yield incorrect outputs without triggering any errors."</em> We replaced that
      checker with something that executes.
    </div>
  </section>

  <!-- ============================= RESULT ============================= -->
  <section>
    <p class="step-label">Result &mdash; what we measured</p>
    <h2>Four numbers, and what each one actually means</h2>
    <p class="src">Measured on the machine this runs on: Apple M4 Max, 128 GB unified memory,
    Ollama 0.31.1. Scripts and raw output are
    <a href="https://github.com/wilsonwu-ai/plan-then-cull/tree/main/experiments">in the repo</a>.</p>

    <div class="numbers">
      <div class="num focal">
        <div class="big">131</div>
        <div>
          <p class="what">Attempts the tiny model produces in 30 seconds</p>
          <p class="means">We ran <code>qwen3:0.6b</code> this morning and counted. One
          "attempt" is one complete answer, about 160 words' worth. So in half a minute it
          writes 131 full, different tries at the same problem. That is the raw material the
          grader culls.</p>
        </div>
      </div>

      <div class="num">
        <div class="big">18</div>
        <div>
          <p class="what">Attempts the 8B model produces in the same 30 seconds</p>
          <p class="means">Same clock, same machine, each model running at its own best
          settings. <code>qwen3:8b</code> has about 13x the parameters and manages 18 attempts
          instead of 131. <b>Going small did not save you money &mdash; it bought you
          attempts.</b> The same half-minute buys either 131 tries or 18. Since this method
          wins by having many tries to throw away, 131 beats 18.</p>
        </div>
      </div>

      <div class="num">
        <div class="big">3.26x</div>
        <div>
          <p class="what">How much you gain by asking for many answers at once</p>
          <p class="means">Ask the server for 16 answers simultaneously and it finishes 3.26
          times faster than asking one at a time. Not 16 times &mdash; <b>3.26</b>. The server
          can overlap some work but not all of it, so there is a hard ceiling on how much
          asking-in-parallel can ever buy you, and it is much lower than the number of things
          you asked for.</p>
        </div>
      </div>

      <div class="num">
        <div class="big">0.98x</div>
        <div>
          <p class="what">What you got before we changed one setting &mdash; and why it is a trap</p>
          <p class="means">On the factory default, asking for 8 answers at once was
          <em>no faster at all</em> than asking one at a time. <b>And nothing warned us.</b>
          Normally software tells you when it cannot do what you asked. This silently lines the
          requests up and runs them one by one &mdash; so you believe you are running 8 in
          parallel while you are actually running 8 in a row. It looks like "small models are
          slow" when the truth is "my server is single-threaded." One environment variable
          (<code>OLLAMA_NUM_PARALLEL=8</code>) took it from 0.98x to 3.26x.</p>
        </div>
      </div>
    </div>

    <h3>The trade, in one table</h3>
    <table>
      <thead><tr><th>Model</th><th class="n">Words/sec</th><th class="n">Attempts per 30s</th><th>What that buys</th></tr></thead>
      <tbody>
        <tr class="focal"><td>qwen3:0.6b</td><td class="n">697</td><td class="n">131</td><td>131 chances one is right</td></tr>
        <tr><td>qwen3:1.7b</td><td class="n">364</td><td class="n">68</td><td>68 chances</td></tr>
        <tr><td>qwen3:8b</td><td class="n">95</td><td class="n">18</td><td>18 chances</td></tr>
      </tbody>
    </table>
    <p class="src">13x the parameters costs about 7x the attempts. On fixed hardware,
    attempts and parameters come out of the same budget &mdash; and this method spends it on
    attempts.</p>

    <div class="note">
      <b>How stable are these numbers?</b> Not very, and you should know that before you
      quote them. We ran the identical script twice on the identical machine, twelve hours
      apart, and <code>qwen3:0.6b</code> came back at 332 words/sec the first time and 697 the
      second &mdash; because the first run happened while the laptop was busy with other work.
      <b>The ratios between models held; the absolute numbers did not.</b> That is why the
      benchmark below asks a whole room to run it: forty machines is a result, one machine
      twice is an anecdote.
    </div>
  </section>

  <!-- =========================== REAL CASE =========================== -->
  <section>
    <p class="step-label">Where this has worked before &mdash; real systems, not an analogy</p>
    <h2>OpenAI measured this in 2021, and the gap was 39.8 points</h2>

    <p>When OpenAI built <b>Codex</b> &mdash; the model behind the first GitHub Copilot &mdash;
    they published a number that is really the whole argument for this project.</p>

    <p>They gave the model 164 programming problems and let it write <b>100 attempts</b> at
    each. Then they asked three different questions about the same pile of attempts.</p>

    <table>
      <thead><tr><th>How you pick an answer</th><th class="n">Problems solved</th></tr></thead>
      <tbody>
        <tr><td>Take one attempt and go with it</td><td class="n">37.7%</td></tr>
        <tr><td>Let the model pick its own favourite of the 100</td><td class="n">44.5%</td></tr>
        <tr class="focal"><td>Run the code and keep whichever attempt works</td><td class="n">77.5%</td></tr>
      </tbody>
    </table>

    <div class="pull">The correct answer was already sitting in the pile <b>77.5%</b> of the
    time. The model could only find it <b>44.5%</b> of the time.</div>

    <p>Read those three rows again, because the middle one is the important one. It is the
    model grading itself &mdash; picking whichever of its own attempts it felt most confident
    about. Of the 39.8 points available between "one attempt" and "run the code," the model's
    own judgment recovered <b>6.8</b>. Executing the code recovered <b>all of them</b>.</p>

    <p>That is why the grader here is an interpreter and not a second model. It is not a
    philosophical preference. OpenAI measured the difference and it was 33 percentage points.</p>

    <div class="note">
      <b>The honest catch, before anyone raises it.</b> That 77.5% was obtained by picking
      with the <em>same tests used to score the answer</em>. The paper calls this an oracle
      and treats it as a ceiling, not a result &mdash; and it is right to.
      <br><br>
      So here is the version without the oracle, from the same paper. On a harder benchmark
      called APPS, they generated 1,000 attempts and filtered them using <b>only the two or
      three example tests printed in the problem statement</b>, while the real grading tests
      stayed hidden. Score went from <b>4.14%</b> to <b>22.78%</b> &mdash; about 5.5x &mdash;
      with no oracle anywhere. That is the honest shape of what this project does, and it is
      the number to hold us to.
      <br><br>
      One more caveat that belongs to us, not to them: those 1,000 attempts are not free.
      Comparing "sample 1,000 and filter" against "sample once" is not a like-for-like
      comparison of compute, and we should not pretend otherwise.
    </div>

    <p class="src">Source: Chen et al. 2021,
    <a href="https://arxiv.org/abs/2107.03374">Evaluating Large Language Models Trained on
    Code</a>, arXiv:2107.03374 &mdash; Figure 1 for the three-way comparison, Table 2 for APPS.
    Codex-S-12B, temperature 0.8.</p>

    <p><b>A note on what we are not claiming.</b> You may reasonably wonder how today's
    frontier models are actually built. We do not know, and neither does anyone outside those
    labs &mdash; the training recipes for shipped models like Claude or the current Codex are
    not public. Everything above is from published research papers, which is the only ground
    we can stand on honestly.</p>
  </section>

  <!-- ========================== LEADERBOARD ========================== -->
  <section>
    <p class="step-label">Run it yourself &mdash; live now</p>
    <h2>We measured one laptop. Help us measure the room.</h2>

    <p>Everything above rests on numbers from a single machine, which we just admitted moved
    by 2x between two runs. The fix is more machines. <b>If you have Ollama with any model
    pulled, two commands puts your laptop on the board.</b></p>

    <pre style="background:var(--wash);border:1px solid var(--rule);border-radius:6px;padding:1rem;overflow-x:auto;font-family:'Geist Mono',ui-monospace,Menlo,monospace;font-size:.85rem"><code style="background:none;border:none;padding:0">curl -sO https://plan-then-cull.wilson-af8.workers.dev/bench.py
python3 bench.py</code></pre>

    <p>It uses whatever model you already have &mdash; it will not download anything. It takes
    about a minute. Add <code>--dry-run</code> to see your numbers without posting.</p>

    <div class="note">
      <b>What it sends:</b> your display name, the model tag, your OS and CPU, and three
      numbers. That is the entire payload, and you can read the whole script before you run it
      &mdash; the first command just downloads it. No prompts, no generated text, no file
      paths. Stdlib Python, about 200 lines,
      <a href="https://plan-then-cull.wilson-af8.workers.dev/bench.py">readable here</a>.
      <br><br>
      <b>The question we actually want answered:</b> we found that asking for many answers at
      once buys 3.26x on this laptop, and only 0.98x before we changed one setting. Nobody
      knows what that number is on your machine. If it comes back near 1.0 for most of the
      room, then a lot of people are silently running in single file and do not know it.
    </div>

    <div id="board"></div>
  </section>

  <!-- ============================== LIVE ============================== -->
  <section>
    <p class="step-label">Live</p>
    <h2>Current round</h2>
    <p>When the system is running, each round posts here: how many attempts were generated,
    how many survived the interpreter, and what the surviving answer was.</p>
    <div class="live" id="live">connecting...</div>
  </section>

  <!-- ============================ GLOSSARY ============================ -->
  <section>
    <h2>Glossary</h2>
    <dl class="glossary">
      <dt>Attempt (also: candidate)</dt>
      <dd>One complete answer written by the model. Sixty attempts means sixty separate
      answers to the same question, not one answer written sixty times.</dd>
      <dt>Width</dt>
      <dd>How many attempts you run at the same time. More width means more chances that one
      of them is correct.</dd>
      <dt>Cull</dt>
      <dd>Delete the attempts that failed the check, and keep the rest.</dd>
      <dt>Parameters</dt>
      <dd>Roughly, the size of a model. <code>qwen3:0.6b</code> has 600 million;
      <code>qwen3:8b</code> has 8 billion. More parameters usually means more capable, slower,
      and more expensive.</dd>
      <dt>Temperature</dt>
      <dd>How random the model's writing is. At 0 it gives the same answer every time, which
      is useless here &mdash; we need sixty <em>different</em> attempts, so we use 0.8.</dd>
      <dt>CPython</dt>
      <dd>The standard Python interpreter, the program that runs when you type
      <code>python3</code>. We use it as the grader because it executes code rather than
      having opinions about it.</dd>
    </dl>
  </section>

  <footer>
    Apple M4 Max &middot; 128 GB &middot; ollama 0.31.1 &middot; measured 30 Aug 2026 &middot;
    <a href="https://github.com/wilsonwu-ai/plan-then-cull">source on GitHub</a> &middot; MIT licensed
  </footer>
</div>
<script>
  // Every value from the network is written with textContent, never innerHTML.
  // Submissions are public and unauthenticated, so a submitted string must
  // never be able to become markup on a projector.
  function cell(row, text, cls){
    var td = document.createElement('td');
    td.textContent = text;
    if (cls) td.className = cls;
    row.appendChild(td);
    return td;
  }

  var liveEl = document.getElementById('live');
  function paintRound(d){
    if (!d || d.status === 'awaiting_rounds' || (d.round && d.round.status === 'standby')) {
      liveEl.textContent = 'No round running yet. This fills in once the local runner starts.';
      return;
    }
    liveEl.textContent = JSON.stringify(d, null, 2);
  }

  var boardEl = document.getElementById('board');
  function paintBoard(d){
    while (boardEl.firstChild) boardEl.removeChild(boardEl.firstChild);
    var entries = (d && d.board) || [];
    if (!entries.length) {
      var p = document.createElement('p');
      p.className = 'src';
      p.textContent = 'No submissions yet. Be the first.';
      boardEl.appendChild(p);
      return;
    }
    var h = document.createElement('h3');
    h.textContent = 'Leaderboard (' + entries.length + ')';
    boardEl.appendChild(h);

    var t = document.createElement('table');
    var thead = document.createElement('thead');
    var hr = document.createElement('tr');
    ['#','Name','Model','Machine','Attempts/30s','Ceiling'].forEach(function(label, i){
      var th = document.createElement('th');
      th.textContent = label;
      if (i >= 4) th.className = 'n';
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    t.appendChild(thead);

    var tb = document.createElement('tbody');
    entries.forEach(function(e, i){
      var tr = document.createElement('tr');
      if (i === 0) tr.className = 'focal';
      cell(tr, String(i + 1), 'n');
      cell(tr, e.name);
      cell(tr, e.model);
      cell(tr, e.os);
      cell(tr, String(e.candidates_per_30s), 'n');
      cell(tr, e.ceiling + 'x', 'n');
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    boardEl.appendChild(t);

    // The finding we most want the room to check: how many machines are
    // silently running in single file?
    var serial = entries.filter(function(e){ return e.ceiling < 1.2; }).length;
    var note = document.createElement('p');
    note.className = 'src';
    note.textContent = serial
      ? serial + ' of ' + entries.length + ' machines are serializing (ceiling under 1.2x) -- '
        + 'asking for many answers at once is buying them nothing.'
      : 'Every machine reporting so far gains something from asking in parallel.';
    boardEl.appendChild(note);
  }

  function poll(){
    fetch('/api/round', {cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(paintRound)
      .catch(function(){ liveEl.textContent = 'offline'; });
    fetch('/api/bench', {cache:'no-store'})
      .then(function(r){ return r.json(); })
      .then(paintBoard)
      .catch(function(){});
  }
  poll();
  setInterval(poll, 5000);
</script>
</body>
</html>`;
