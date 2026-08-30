/**
 * Strongly consistent state for the Sundai audience demo.
 *
 * One SQLite-backed Durable Object, named "sundai-138", serializes joins and
 * runner updates. Public responses never include participant tokens or the
 * runner's bearer token.
 */

export const LIVE_SESSION_ID = "sundai-138";
export const LIVE_CHALLENGE_ID = "lunar-route-v1";
export const MAX_RUN_BYTES = 16 * 1024;

const SCHEMA_VERSION = 1;
const MAX_PARTICIPANTS = 200;
const JOIN_RATE_WINDOW_MS = 10 * 1000;
const JOIN_RATE_MAX = 60;
// qwen3:8b can spend tens of seconds writing the checker without an
// intermediate HTTP update, especially on a cold or busy host. Allow that
// legitimate planning interval before labeling a run stale.
const STALE_AFTER_MS = 60 * 1000;
const COOKIE_NAME = "ptc_participant";

const RUN_STATUSES = new Set([
  "collecting",
  "planning",
  "sampling",
  "checking",
  "success",
  "budget",
  "collapse",
  "error",
  "standby",
]);

const ACTIVE_STATUSES = new Set(["collecting", "planning", "sampling", "checking"]);
const ALLOWED_NODES = new Set(["BASE", "A", "B", "C", "D", "E", "ROVER"]);
const REJECTION_KEYS = [
  "invalid_json",
  "wrong_shape",
  "bad_endpoints",
  "unknown_node",
  "repeated_node",
  "offline_node",
  "bad_hop",
  "latency",
  "bandwidth",
];

const TOP_LEVEL_KEYS = [
  "run_id",
  "seq",
  "status",
  "join_open",
  "challenge_id",
  "base_attempts",
  "candidate_target",
  "generated",
  "checked",
  "culled",
  "survived",
  "elapsed_ms",
  "model",
  "planner_model",
  "checker",
  "rejection_counts",
  "result",
  "message",
];

const CHECKER_KEYS = [
  "known_good_passed",
  "known_bad_rejected",
  "locked",
  "source_preview",
];

const RESULT_KEYS = ["route", "latency_ms", "bandwidth_mbps"];

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function integer(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

function finiteNumber(value, min, max) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function safeString(value, max, allowNewlines = false) {
  if (typeof value !== "string" || value.length > max) return false;
  for (const ch of value) {
    const code = ch.codePointAt(0);
    if (code === 0 || code === 127) return false;
    if (code < 32 && !(allowNewlines && (code === 9 || code === 10 || code === 13))) return false;
  }
  return true;
}

function validRunId(value) {
  if (!safeString(value, 64) || value.length < 1) return false;
  const first = value.codePointAt(0);
  const alphaNumeric =
    (first >= 48 && first <= 57) ||
    (first >= 65 && first <= 90) ||
    (first >= 97 && first <= 122);
  if (!alphaNumeric) return false;
  for (const ch of value) {
    const code = ch.codePointAt(0);
    const allowed =
      (code >= 48 && code <= 57) ||
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      ch === "." || ch === "_" || ch === ":" || ch === "-";
    if (!allowed) return false;
  }
  return true;
}

function participantTokenFromCookie(cookie) {
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(COOKIE_NAME + "=")) continue;
    const token = trimmed.slice(COOKIE_NAME.length + 1);
    if (token.length !== 36) return null;
    for (let i = 0; i < token.length; i++) {
      const ch = token[i];
      const isHex =
        (ch >= "0" && ch <= "9") ||
        (ch >= "a" && ch <= "f") ||
        (ch >= "A" && ch <= "F");
      if ((i === 8 || i === 13 || i === 18 || i === 23) ? ch !== "-" : !isHex) return null;
    }
    return token.toLowerCase();
  }
  return null;
}

function participantCookie(token) {
  return [
    COOKIE_NAME + "=" + token,
    "Path=/api/live",
    "Max-Age=86400",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
  ].join("; ");
}

function defaultRun() {
  return {
    run_id: null,
    seq: -1,
    status: "standby",
    join_open: false,
    challenge_id: LIVE_CHALLENGE_ID,
    base_attempts: 0,
    candidate_target: 0,
    generated: 0,
    checked: 0,
    culled: 0,
    survived: 0,
    elapsed_ms: 0,
    model: "",
    planner_model: "",
    checker: {
      known_good_passed: false,
      known_bad_rejected: false,
      locked: false,
      source_preview: "",
    },
    rejection_counts: Object.fromEntries(REJECTION_KEYS.map((key) => [key, 0])),
    result: null,
    message: "Waiting for the local runner.",
    updated_at: null,
  };
}

function defaultState() {
  return {
    schema: SCHEMA_VERSION,
    session_id: LIVE_SESSION_ID,
    version: 0,
    updated_at: new Date().toISOString(),
    run: defaultRun(),
    participant_tokens: [],
    recent_run_ids: [],
    join_rate: { window_started_ms: 0, count: 0 },
  };
}

function publicSnapshot(state) {
  const now = Date.now();
  const runUpdated = state.run.updated_at ? Date.parse(state.run.updated_at) : NaN;
  const stale =
    ACTIVE_STATUSES.has(state.run.status) &&
    (!Number.isFinite(runUpdated) || now - runUpdated > STALE_AFTER_MS);
  const audienceTarget = Math.max(0, state.run.candidate_target - state.run.base_attempts);

  return {
    schema: SCHEMA_VERSION,
    session_id: LIVE_SESSION_ID,
    version: state.version,
    server_time: new Date(now).toISOString(),
    updated_at: state.updated_at,
    stale,
    stale_after_ms: STALE_AFTER_MS,
    phase: state.run.status,
    challenge: { id: LIVE_CHALLENGE_ID },
    audience: {
      joined: state.participant_tokens.length,
      target: audienceTarget,
    },
    run: state.run,
  };
}

/** Validate and normalize the complete authenticated runner snapshot. */
export function validateRunPayload(body) {
  const errors = [];
  if (!exactKeys(body, TOP_LEVEL_KEYS)) {
    return { ok: false, errors: ["top_level_schema"] };
  }

  if (!validRunId(body.run_id)) errors.push("run_id");
  if (!integer(body.seq, 0, 1_000_000_000)) errors.push("seq");
  if (!RUN_STATUSES.has(body.status)) errors.push("status");
  if (typeof body.join_open !== "boolean") errors.push("join_open");
  if (body.join_open && body.status !== "collecting") errors.push("join_open_status");
  if (body.challenge_id !== LIVE_CHALLENGE_ID) errors.push("challenge_id");
  if (!integer(body.base_attempts, 0, 1000)) errors.push("base_attempts");
  if (!integer(body.candidate_target, 1, 1000)) errors.push("candidate_target");
  if (
    integer(body.base_attempts, 0, 1000) &&
    integer(body.candidate_target, 1, 1000) &&
    body.base_attempts > body.candidate_target
  ) errors.push("base_attempts_target");

  for (const key of ["generated", "checked", "culled", "survived"]) {
    if (!integer(body[key], 0, 1000)) errors.push(key);
  }
  if (!integer(body.elapsed_ms, 0, 86_400_000)) errors.push("elapsed_ms");
  if (!safeString(body.model, 80)) errors.push("model");
  if (!safeString(body.planner_model, 80)) errors.push("planner_model");
  if (!safeString(body.message, 500, true)) errors.push("message");

  if (
    integer(body.generated, 0, 1000) &&
    integer(body.candidate_target, 1, 1000) &&
    body.generated > body.candidate_target
  ) errors.push("generated_target");
  if (integer(body.checked, 0, 1000) && integer(body.generated, 0, 1000) && body.checked > body.generated) {
    errors.push("checked_generated");
  }
  if (
    integer(body.culled, 0, 1000) &&
    integer(body.survived, 0, 1000) &&
    integer(body.checked, 0, 1000) &&
    body.culled + body.survived !== body.checked
  ) errors.push("checked_partition");

  if (!exactKeys(body.checker, CHECKER_KEYS)) {
    errors.push("checker_schema");
  } else {
    for (const key of ["known_good_passed", "known_bad_rejected", "locked"]) {
      if (typeof body.checker[key] !== "boolean") errors.push("checker_" + key);
    }
    if (!safeString(body.checker.source_preview, 2000, true)) errors.push("checker_source_preview");
  }

  if (!exactKeys(body.rejection_counts, REJECTION_KEYS)) {
    errors.push("rejection_counts_schema");
  } else {
    let rejectionTotal = 0;
    for (const key of REJECTION_KEYS) {
      if (!integer(body.rejection_counts[key], 0, 1000)) {
        errors.push("rejection_count_" + key);
      } else {
        rejectionTotal += body.rejection_counts[key];
      }
    }
    if (integer(body.culled, 0, 1000) && rejectionTotal !== body.culled) {
      errors.push("rejection_count_total");
    }
  }

  if (body.result !== null) {
    if (!exactKeys(body.result, RESULT_KEYS)) {
      errors.push("result_schema");
    } else {
      if (
        !Array.isArray(body.result.route) ||
        body.result.route.length < 2 ||
        body.result.route.length > 7 ||
        body.result.route.some((node) => !ALLOWED_NODES.has(node))
      ) errors.push("result_route");
      if (!finiteNumber(body.result.latency_ms, 0, 100)) errors.push("result_latency_ms");
      if (!finiteNumber(body.result.bandwidth_mbps, 0, 100)) errors.push("result_bandwidth_mbps");
    }
  }
  if (body.status === "success" && body.result === null) errors.push("success_result");
  if (body.status !== "success" && body.result !== null) errors.push("non_success_result");

  const checkerMustBeLocked = new Set(["sampling", "checking", "success", "budget", "collapse"]);
  if (
    checkerMustBeLocked.has(body.status) &&
    exactKeys(body.checker, CHECKER_KEYS) &&
    (!body.checker.known_good_passed || !body.checker.known_bad_rejected || !body.checker.locked)
  ) errors.push("checker_not_validated");
  if (body.status === "success" && integer(body.survived, 0, 1000) && body.survived < 1) {
    errors.push("success_without_survivor");
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    value: {
      ...body,
      checker: { ...body.checker },
      rejection_counts: { ...body.rejection_counts },
      result: body.result
        ? {
            route: [...body.result.route],
            latency_ms: Math.round(body.result.latency_ms * 100) / 100,
            bandwidth_mbps: Math.round(body.result.bandwidth_mbps * 100) / 100,
          }
        : null,
    },
  };
}

export class LiveRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async load() {
    return (await this.state.storage.get("state")) || defaultState();
  }

  async save(state) {
    await this.state.storage.put("state", state);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/state" && request.method === "GET") return this.getState();
    if (url.pathname === "/join" && request.method === "POST") return this.join(request);
    if (url.pathname === "/run" && request.method === "POST") return this.updateRun(request);
    return json({ error: "method_not_allowed" }, 405, { allow: "GET, POST" });
  }

  async getState() {
    const state = await this.load();
    const snapshot = publicSnapshot(state);
    return json(snapshot, 200, { etag: 'W/"live-' + snapshot.version + '"' });
  }

  async join(request) {
    const state = await this.load();
    if (state.run.status !== "collecting" || !state.run.join_open) {
      return json({ error: "joins_closed" }, 403);
    }

    let token = participantTokenFromCookie(request.headers.get("cookie"));
    let participantIndex = token ? state.participant_tokens.indexOf(token) : -1;
    if (participantIndex >= 0) {
      const snapshot = publicSnapshot(state);
      return json(
        {
          ok: true,
          joined: true,
          deduped: true,
          participant_number: participantIndex + 1,
          audience: snapshot.audience,
          version: snapshot.version,
        },
        200,
        { "set-cookie": participantCookie(token) }
      );
    }

    const audienceCapacity = Math.min(
      MAX_PARTICIPANTS,
      Math.max(0, state.run.candidate_target - state.run.base_attempts)
    );
    if (state.participant_tokens.length >= audienceCapacity) {
      return json({ error: "audience_full" }, 409);
    }

    const now = Date.now();
    if (now - state.join_rate.window_started_ms >= JOIN_RATE_WINDOW_MS) {
      state.join_rate = { window_started_ms: now, count: 0 };
    }
    if (state.join_rate.count >= JOIN_RATE_MAX) {
      const retryAfter = Math.max(
        1,
        Math.ceil((state.join_rate.window_started_ms + JOIN_RATE_WINDOW_MS - now) / 1000)
      );
      return json(
        { error: "join_rate_limited", retry_after_seconds: retryAfter },
        429,
        { "retry-after": String(retryAfter) }
      );
    }

    token = crypto.randomUUID().toLowerCase();
    state.participant_tokens.push(token);
    state.join_rate.count += 1;
    state.version += 1;
    state.updated_at = new Date(now).toISOString();
    await this.save(state);

    participantIndex = state.participant_tokens.length - 1;
    const snapshot = publicSnapshot(state);
    return json(
      {
        ok: true,
        joined: true,
        deduped: false,
        participant_number: participantIndex + 1,
        audience: snapshot.audience,
        version: snapshot.version,
      },
      200,
      { "set-cookie": participantCookie(token) }
    );
  }

  async updateRun(request) {
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return json({ error: "bad_json" }, 400);
    }
    const validated = validateRunPayload(body);
    if (!validated.ok) return json({ error: "invalid_run", fields: validated.errors }, 422);

    const next = validated.value;
    const state = await this.load();
    const currentId = state.run.run_id;
    const isNewRun = currentId === null || next.run_id !== currentId;

    if (isNewRun) {
      if (next.seq !== 0) {
        return json({ error: "new_run_must_start_at_zero", current_run_id: currentId }, 409);
      }
      if (state.recent_run_ids.includes(next.run_id)) {
        return json({ error: "retired_run_id" }, 409);
      }
      if (currentId !== null) {
        state.recent_run_ids.push(currentId);
        state.recent_run_ids = state.recent_run_ids.slice(-16);
      }
      state.participant_tokens = [];
      state.join_rate = { window_started_ms: 0, count: 0 };
    } else if (next.seq <= state.run.seq) {
      return json({ error: "stale_sequence", accepted_seq: state.run.seq }, 409);
    }

    const now = new Date().toISOString();
    state.run = { ...next, updated_at: now };
    state.version += 1;
    state.updated_at = now;
    await this.save(state);

    const snapshot = publicSnapshot(state);
    return json({ ok: true, version: snapshot.version, run: snapshot.run, audience: snapshot.audience });
  }
}
