/**
 * The public page, told as a story.
 *
 * Structure opens with the familiar OpenAI result, then tells the project as
 * STAR: Situation, Task & Action, Result, and where the work fits in a full
 * distillation pipeline.
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
<title>Distillation &mdash; pull and cull</title>
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

  .terminal-grid{
    display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1rem;
    margin:1.5rem 0 2.5rem;
  }
  .terminal-figure{margin:0; min-width:0}
  .terminal-window{
    overflow:hidden; border:1px solid #334155; border-radius:8px;
    background:#0f172a; box-shadow:0 12px 30px rgba(15,23,42,0.18);
  }
  .terminal-bar{
    min-height:2.35rem; padding:.55rem .7rem; display:flex; align-items:center; gap:.65rem;
    background:#182235; border-bottom:1px solid #334155;
    font-family:'Geist Mono',ui-monospace,Menlo,monospace;
  }
  .terminal-lights{display:flex; gap:.3rem; flex:0 0 auto}
  .terminal-light{width:.55rem; height:.55rem; border-radius:50%; display:block}
  .terminal-light.red{background:#fb7185}
  .terminal-light.amber{background:#fbbf24}
  .terminal-light.green{background:#4ade80}
  .terminal-name{
    color:#cbd5e1; font-size:.66rem; letter-spacing:.04em; white-space:nowrap;
    overflow:hidden; text-overflow:ellipsis;
  }
  .terminal-badge{
    margin-left:auto; color:#94a3b8; border:1px solid #475569; border-radius:999px;
    padding:.08rem .42rem; font-size:.55rem; letter-spacing:.08em; text-transform:uppercase;
    white-space:nowrap;
  }
  .terminal-body{
    min-height:25rem; margin:0; padding:1rem; overflow-x:auto; color:#dbe4f0;
    font-family:'Geist Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
    font-size:.75rem; line-height:1.55; white-space:pre-wrap; word-break:normal;
  }
  .terminal-body code{
    padding:0; border:0; border-radius:0; background:none; color:inherit;
    font:inherit;
  }
  .term-prompt{color:#86efac}
  .term-model{color:#fdba74}
  .term-key{color:#93c5fd}
  .term-pass{color:#86efac; font-weight:600}
  .term-fail{color:#fda4af; font-weight:600}
  .term-answer{color:#fef08a; font-weight:600}
  .term-dim{color:#94a3b8}
  .terminal-figure figcaption{padding:0 .35rem; line-height:1.45}

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
  @media (max-width:720px){
    .terminal-grid{grid-template-columns:1fr}
    .terminal-body{min-height:0; font-size:.75rem}
  }
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

  <p class="eyebrow">plan-then-cull &middot; Sundai Hack 138 &middot; MIT &middot; 30 August 2026</p>
  <h1>Distillation</h1>
  <p class="lede"><b>Part one: pull and cull.</b> Pull sixty attempts from a tiny model. Cull
  the ones that fail a Python test written once by a bigger model.</p>
  <p class="sub"><b>Part two: train on the survivors.</b> This hack builds part one. Nothing is
  trained yet; the survivors can later become mechanically checked training examples.</p>

  <!-- =========================== OPENAI PROOF =========================== -->
  <section>
    <p class="step-label">Start here &mdash; OpenAI Codex</p>
    <h2>With 100 tries, Codex solved 77.5% of problems. With one try, 37.7%.</h2>

    <p>When OpenAI built <b>Codex</b> &mdash; the model behind the first GitHub Copilot &mdash;
    it measured the exact gap this project tackles: a passing answer can already be in the pile
    even when the model cannot pick it.</p>

    <p>They gave Codex 164 programming problems and let it write <b>100 attempts</b> at each.
    Then they asked three different questions about the same pile of attempts.</p>

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

    <p>The middle row is the important one. It is the model grading itself &mdash; picking the
    attempt it felt most confident about. Of the 39.8 points available between "one attempt"
    and "run the code," the model's own judgment recovered <b>6.8</b>. Executing the code
    recovered <b>all of them</b>.</p>

    <p>That is why part one needs a grader that runs, not another model with another opinion.
    OpenAI measured the difference and it was 33 percentage points.</p>

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

    <p><b>A note on what we are not claiming.</b> The training recipes for today's shipped
    frontier models are not public. Everything above is from published research, which is the
    only ground we can stand on honestly.</p>

    <p>That is pull and cull: pull many attempts, run a real check, and cull what fails. This
    project asks whether the same pattern can make a tiny local model useful &mdash; and whether
    the survivors can become training examples.</p>
  </section>

  <!-- ============================ SITUATION ============================ -->
  <section>
    <p class="step-label">Why this matters &mdash; the problem</p>
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
    <p class="step-label">Part one &mdash; pull and cull</p>
    <h2>Stop asking the model to be right. Ask it many times, and check.</h2>

    <p>If one attempt from a small model is unreliable, sixty attempts are sixty chances that
    <em>at least one</em> is correct. That is only useful if you can tell which one. So the
    real problem is not generation. It is <b>checking</b>.</p>

    <h3 id="terminal-run">What one run looks like</h3>
    <p><b>Illustrated run, not recorded output.</b> The first terminal asks the larger model
    for one checker. The second asks the tiny model for many answers and lets CPython remove
    the failures. The live runner supplies its own answers, survivor count, and timing.</p>

    <div class="terminal-grid" role="group" aria-label="Illustrative terminal transcript of one pull-and-cull run">
      <figure class="terminal-figure" id="terminal-checker">
        <div class="terminal-window">
          <div class="terminal-bar">
            <span class="terminal-lights" aria-hidden="true">
              <span class="terminal-light red"></span>
              <span class="terminal-light amber"></span>
              <span class="terminal-light green"></span>
            </span>
            <span class="terminal-name">planner &middot; qwen3:8b</span>
            <span class="terminal-badge">illustrative</span>
          </div>
          <pre class="terminal-body"><code><span class="term-prompt">$ ollama run qwen3:8b</span>

<span class="term-model">&gt;&gt;&gt; Write check(answer) for:</span>
    exactly five words;
    every word starts with S.

<span class="term-key">def check(answer):</span>
    words = answer.split()
    return len(words) == 5 and all(
        word[:1].lower() == "s"
        for word in words
    )

<span class="term-key">TEST THE TEST</span>
<span class="term-pass">[OK]</span> known-good &rarr; True &rarr; accepted
     <span class="term-dim">"Silent silver stars shine softly"</span>
<span class="term-pass">[OK]</span> known-bad  &rarr; False &rarr; rejected
     <span class="term-dim">"Silent silver stars glow softly"</span>

<span class="term-key">checker locked</span>  both probes behaved correctly</code></pre>
        </div>
        <figcaption>The expensive model writes one auditable Python rule, then stops.</figcaption>
      </figure>

      <figure class="terminal-figure" id="terminal-cull">
        <div class="terminal-window">
          <div class="terminal-bar">
            <span class="terminal-lights" aria-hidden="true">
              <span class="terminal-light red"></span>
              <span class="terminal-light amber"></span>
              <span class="terminal-light green"></span>
            </span>
            <span class="terminal-name">runner &middot; qwen3:0.6b + CPython</span>
            <span class="terminal-badge">illustrative</span>
          </div>
          <pre class="terminal-body"><code><span class="term-model">[qwen3:0.6b]</span> pull 60 attempts

<span class="term-dim">[01]</span> Small silver stars glow softly
     <span class="term-fail">FAIL</span>
<span class="term-dim">[02]</span> Silent silver stars shine softly
     <span class="term-pass">PASS</span>
<span class="term-dim">[03]</span> Seven bright stars shine slowly
     <span class="term-fail">FAIL</span>
<span class="term-dim"> ... 56 more attempts ...</span>
<span class="term-dim">[60]</span> Soft summer skies stay sunny
     <span class="term-pass">PASS</span>

<span class="term-key">[CPython]</span> checked 60 of 60
<span class="term-fail">[cull]</span>     56 deleted
<span class="term-pass">[keep]</span>      4 survived

<span class="term-answer">answer  Silent silver stars shine softly</span>
<span class="term-pass">exit    SUCCESS &middot; round 1</span>
<span class="term-dim">other   budget &middot; collapse fails closed</span></code></pre>
        </div>
        <figcaption>The cheap model supplies the attempts; CPython decides what survives.</figcaption>
      </figure>
    </div>

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

    <h3>What is actually being checked &mdash; and what is not</h3>

    <p>This is the part most worth being precise about, because it is easy to hear the wrong
    thing.</p>

    <div class="pull">The interpreter does not know whether an answer is <b>correct</b>.
    It knows whether the answer <b>satisfies the rule</b>. Those are different claims.</div>

    <p>If you have written evals before, this will be familiar: it is exactly
    <em>"does this output pass the eval?"</em> &mdash; not <em>"is this output true?"</em>
    An eval does not have opinions about truth. It has a pass condition, and it applies it.</p>

    <p>That distinction sets a hard boundary on where this technique works at all. It needs
    correctness to be <b>mechanically decidable</b> &mdash; something a program can settle by
    running, with no judgment involved. Three families qualify:</p>

    <table>
      <thead><tr><th>Use case</th><th>What the rule checks</th><th>Example</th></tr></thead>
      <tbody>
        <tr>
          <td><b>Constraint satisfaction</b></td>
          <td>A structural rule holds over the whole output</td>
          <td>Every word starts with S. Exactly 12 syllables. No word repeats.</td>
        </tr>
        <tr>
          <td><b>Code with tests</b></td>
          <td>The code runs and the tests pass</td>
          <td><code>solve(7)</code> must return <code>42</code>, and it does</td>
        </tr>
        <tr>
          <td><b>Math with a checkable answer</b></td>
          <td>The computed value equals the expected one</td>
          <td>The program prints <code>0.5</code>, and <code>1/2</code> is accepted as equal</td>
        </tr>
        <tr>
          <td><b>Format compliance</b></td>
          <td>The output parses against a schema</td>
          <td>Valid JSON, with the required fields, of the required types</td>
        </tr>
      </tbody>
    </table>

    <p><b>And what does not qualify:</b> "is this essay persuasive", "is this summary fair",
    "is this the best design". No program settles those, so there is nothing for an interpreter
    to enforce, and this method has nothing to offer. It is a technique for a specific class of
    problem, not a general way to make small models smarter.</p>

    <h3>The obvious objection: who checks the checker?</h3>

    <p>A fair reader stops here and says: the rule was written by a model too. If
    <code>qwen3:8b</code> writes a <em>wrong</em> <code>check()</code>, then CPython enforces
    the wrong rule perfectly, on all sixty candidates, without complaint. Garbage in,
    rigorously verified garbage out.</p>

    <p><b>That objection is correct, and it is worth stating plainly rather than defending
    against.</b> We did not remove the fallibility. We moved it somewhere you can inspect.</p>

    <table>
      <thead><tr><th></th><th>A model grades each answer</th><th>A model writes one rule, a machine enforces it</th></tr></thead>
      <tbody>
        <tr><td><b>Things that can be wrong</b></td><td class="n">60 separate judgments</td><td class="n">1 rule</td></tr>
        <tr><td><b>Can a human read it?</b></td><td>No</td><td>Yes &mdash; it is a few lines of Python</td></tr>
        <tr><td><b>Can you test it?</b></td><td>Not really</td><td>Yes, in seconds</td></tr>
        <tr><td><b>Same answer twice?</b></td><td>Not guaranteed</td><td>Guaranteed</td></tr>
        <tr class="focal"><td><b>Where the risk sits</b></td><td>Spread across 60 opaque calls</td><td>Concentrated in 1 auditable artifact</td></tr>
      </tbody>
    </table>

    <p>One thing to get right instead of sixty, and you can actually look at it. That is the
    honest claim. It is narrower than "the interpreter cannot be argued with", which is what an
    earlier version of this page said &mdash; the interpreter cannot be argued with about
    <em>whether the rule was satisfied</em>, but it has no view on whether the rule was any
    good.</p>

    <div class="note">
      <b>So we test the test, before trusting it.</b> Before any candidate is graded, the
      <code>check()</code> function has to survive two probes:
      <br><br>
      1. Give it a <b>known-good</b> answer. It must return true. A rule that rejects a correct
      answer is broken.<br>
      2. Give it a <b>known-bad</b> answer. It must return false. This one matters more, because
      of the failure mode below.
      <br><br>
      <b>The vacuous checker is the danger.</b> A model asked to write a test, under pressure to
      produce something that works, can write <code>def check(answer): return True</code>. That
      passes every candidate. Every round succeeds. The run looks like a triumph and has
      measured nothing at all &mdash; and unlike a crash, nothing about it looks wrong.
      <br><br>
      Hence the rule: <b>a checker that has never rejected anything is not a checker.</b>
      If it cannot reject a deliberately wrong answer, we throw it away and generate another.
    </div>

    <p class="src">This is also the one place we differ from the paper we build on. In
    <a href="https://arxiv.org/abs/2504.07081">DisCIPL</a> the checking program is model-written
    and approximate, and the paper is candid that bugs in generated programs can
    <em>"yield incorrect outputs without triggering any errors."</em> We execute the rule rather
    than approximate it, and we test the rule before we trust it. Neither of those makes it
    infallible.</p>

    <h3>When does the loop stop?</h3>

    <p>"Survivors go again" is only half a design. A loop needs a way out, and it needs
    <b>three</b>, because there are three genuinely different ways a round can end.</p>

    <figure>
    <svg viewBox="0 0 520 300" role="img" aria-labelledby="exits-title exits-desc">
      <title id="exits-title">The three ways the loop ends</title>
      <desc id="exits-desc">After grading, the loop takes one of three exits. If at least one
      candidate passed, it returns that answer and stops. If the round budget or time limit is
      reached, it stops and reports the best it found. If zero candidates survived, it stops
      and reports honest failure rather than relaxing the rule until something passes.</desc>
      <defs>
        <marker id="ea" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto">
          <polygon points="0 0, 9 3.5, 0 7" fill="var(--soft)"/>
        </marker>
      </defs>

      <line x1="260" y1="60" x2="260" y2="84" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#ea)"/>
      <path d="M 140 108 H 92 Q 84 108 84 116 V 140" fill="none" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#ea)"/>
      <line x1="260" y1="132" x2="260" y2="140" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#ea)"/>
      <path d="M 380 108 H 428 Q 436 108 436 116 V 140" fill="none" stroke="var(--soft)" stroke-width="1.5" marker-end="url(#ea)"/>

      <rect x="140" y="20" width="240" height="40" rx="6" fill="var(--card)" stroke="var(--rule)"/>
      <text x="260" y="45" fill="var(--ink)" font-size="14" font-weight="600"
            font-family="'Geist',sans-serif" text-anchor="middle">A round finishes grading</text>

      <rect x="140" y="84" width="240" height="48" rx="6" fill="var(--wash)" stroke="var(--rule)"/>
      <text x="260" y="104" fill="var(--muted)" font-size="12" font-weight="600"
            font-family="'Geist',sans-serif" text-anchor="middle">how many survived?</text>
      <text x="260" y="122" fill="var(--soft)" font-size="10"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle">one or more &#183; some, but out of budget &#183; none</text>

      <rect x="20" y="140" width="128" height="72" rx="6" fill="var(--accent-tint)" stroke="var(--accent)"/>
      <text x="84" y="162" fill="var(--accent)" font-size="9" font-weight="600"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle" letter-spacing="1.2">EXIT 1 &#183; SUCCESS</text>
      <text x="84" y="182" fill="var(--ink)" font-size="12" font-weight="600"
            font-family="'Geist',sans-serif" text-anchor="middle">One passed</text>
      <text x="84" y="200" fill="var(--muted)" font-size="10"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle">return it, stop</text>

      <rect x="196" y="140" width="128" height="72" rx="6" fill="var(--card)" stroke="var(--rule)"/>
      <text x="260" y="162" fill="var(--muted)" font-size="9" font-weight="600"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle" letter-spacing="1.2">EXIT 2 &#183; BUDGET</text>
      <text x="260" y="182" fill="var(--ink)" font-size="12" font-weight="600"
            font-family="'Geist',sans-serif" text-anchor="middle">Out of rounds</text>
      <text x="260" y="200" fill="var(--muted)" font-size="10"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle">report best so far</text>

      <rect x="372" y="140" width="128" height="72" rx="6" fill="var(--card)" stroke="var(--rule)"/>
      <text x="436" y="162" fill="var(--muted)" font-size="9" font-weight="600"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle" letter-spacing="1.2">EXIT 3 &#183; COLLAPSE</text>
      <text x="436" y="182" fill="var(--ink)" font-size="12" font-weight="600"
            font-family="'Geist',sans-serif" text-anchor="middle">Zero survived</text>
      <text x="436" y="200" fill="var(--muted)" font-size="10"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace" text-anchor="middle">say so, do not fudge</text>

      <line x1="20" y1="244" x2="500" y2="244" stroke="var(--rule)" stroke-width="1"/>
      <text x="20" y="264" fill="var(--soft)" font-size="10"
            font-family="'Geist Mono',ui-monospace,Menlo,monospace">ONLY EXIT 1 IS A WIN. THE OTHER TWO ARE REPORTED, NOT HIDDEN.</text>
    </svg>
    <figcaption>Three exits. A loop with only the first one is a loop that never admits
    failure.</figcaption>
    </figure>

    <p><b>Exit 3 is the one that matters most</b>, and it is the one most systems quietly get
    wrong. If zero candidates survive, the population is dead &mdash; there is nothing left to
    resample from. The tempting move is to relax the rule until something squeaks through, and
    then report success.</p>

    <div class="pull">We fail closed. If nothing passes, the answer is <b>"nothing passed in
    N attempts"</b> &mdash; not a weakened rule and a green tick.</div>

    <p>A system that always returns an answer is a system that will eventually hand you a wrong
    one with total confidence. Reporting the empty result is the whole point of having a
    grader.</p>
  </section>

  <!-- ============================= RESULT ============================= -->
  <section>
    <p class="step-label">Part one &mdash; what we measured</p>
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

  <!-- ============================ PART TWO ============================ -->
  <section>
    <p class="step-label">Part two &mdash; train on the survivors</p>
    <h2>Culling finds good answers. Training makes them stick.</h2>

    <p>Part one happens at <b>question time</b>. You ask, we pull sixty attempts, cull the
    failures, and return what survived. The model itself is completely unchanged &mdash; it is
    exactly as capable afterward as it was before. Ask the same question tomorrow and you pay
    the whole cost again.</p>

    <p>That is worth sitting with, because it is the technique's real weakness.</p>

    <table>
      <thead><tr><th></th><th>Part one: pull and cull</th><th>Part two: train</th></tr></thead>
      <tbody>
        <tr><td><b>When it happens</b></td><td>Every time you ask a question</td><td>Once, during training</td></tr>
        <tr><td><b>Does the model change?</b></td><td>No. Weights untouched.</td><td>Yes. Permanently.</td></tr>
        <tr><td><b>What it costs</b></td><td>60x the compute, forever</td><td>One training run, then free</td></tr>
        <tr><td><b>What you get</b></td><td>A better answer, this once</td><td>A better model</td></tr>
      </tbody>
    </table>

    <h3>How part two works</h3>

    <p>Distillation is how a small model inherits ability from a large one. A big
    <b>teacher</b> model produces outputs; a small <b>student</b> model trains on them. The
    student never sees the teacher's internals &mdash; it just learns to produce the same kinds
    of answers. Done well, a small model ends up far better than its size would suggest,
    because it learned from a curated diet rather than the raw internet.</p>

    <p>This is not a niche trick. It is a substantial part of why capable small models exist at
    all, and it is what makes a model that fits on a laptop worth having.</p>

    <h3>And here is the join</h3>

    <p>Distillation has an obvious weakness of its own: <b>the teacher is sometimes wrong.</b>
    Train a student on unfiltered teacher output and you faithfully teach it the teacher's
    mistakes. Worse, supervised training is intolerant in a way pretraining is not &mdash; a
    wrong example is not diluted among billions of tokens, it is <em>taught</em>.</p>

    <p>So you want to filter the teacher's output before training on it. And filtering
    generated candidates by executing them is&hellip; exactly what this page has been about.</p>

    <div class="pull">Pull the candidates. Cull the failures.
    <b>Then train on the survivors.</b></div>

    <p>Which means <b>plan-then-cull is the front half of a distillation pipeline</b>. The same
    loop that gets you a good answer today can, pointed at a corpus instead of a question,
    manufacture verified training data &mdash; every example of which is one whose code
    actually ran and actually produced the stated answer.</p>

    <p>That is why <b>Distillation</b> sits at the top of this page even though this hack builds
    only part one. Pull and cull gets a reliable answer out of an unreliable model now, and
    creates the verified examples that can make it permanently smarter later.</p>
  </section>

  <!-- ============================== Q&A ============================== -->
  <section>
    <p class="step-label">Questions worth asking</p>
    <h2>The objections, and honest answers</h2>
    <p class="src">These are the actual questions asked while building this. They are the ones a
    careful reader arrives at, so they are answered here rather than left for the Q&amp;A.</p>

    <h3>If small models are wrong a lot, how does the interpreter know an answer is right?</h3>
    <p>It does not. It knows whether the answer <b>satisfies the rule</b>. If the rule captures
    what "correct" means for your task, that is the same thing. If it does not, the interpreter
    will happily certify a wrong answer. Everything here depends on picking tasks where a rule
    can capture correctness &mdash; code with tests, math with a checkable value, structural
    constraints, schema compliance.</p>

    <h3>Does the big model write the answer that the small model tries to match?</h3>
    <p>No, and this is worth being clear about. <b>The big model never produces an answer.</b>
    It writes a test and stops. The sixty attempts are never compared against a big-model
    answer &mdash; they are compared against a rule. The expensive model contributes the
    standard, not the content.</p>

    <h3>Who says the big model's test is correct?</h3>
    <p>Nobody, and this is the sharpest objection to the whole design. A model-written rule can
    be wrong, and the interpreter will then enforce something wrong with total consistency. What
    we get is not infallibility, it is <b>auditability</b>: one rule you can read and test,
    instead of sixty judgments you cannot. Plus the two probes above &mdash; the rule must accept
    a known-good answer and reject a known-bad one before we trust it.</p>

    <h3>If the test is faulty, is the small model being trained on a broken system?</h3>
    <p>Nothing is being trained here &mdash; no weights change, so there is no lasting damage; a
    bad rule spoils one query. <b>But the concern becomes real the moment you use this to
    generate training data</b>, which is exactly the distillation step above. At that point a
    faulty checker stops spoiling one answer and starts teaching a permanent mistake. That is
    why the checker validation is not optional the moment you cross from answering into
    training.</p>

    <h3>The survivors loop around &mdash; when does it stop?</h3>
    <p>Three exits: a candidate passes, the budget runs out, or nothing survives. The third is
    reported as failure rather than papered over by loosening the rule.</p>

    <h3>Is this the same thing as the models trained on other models' answers?</h3>
    <p>No &mdash; those are trained, this is not. See the section above: training changes the
    model permanently, searching changes only today's answer. They are complementary, and the
    output of this feeds the input of that.</p>
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
