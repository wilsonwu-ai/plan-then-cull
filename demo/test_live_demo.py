import copy
import io
from contextlib import redirect_stderr, redirect_stdout
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import demo.live_demo as live_demo
from demo.live_demo import (
    BAD_PROBES,
    GOOD_PROBE,
    REJECTION_KEYS,
    all_simple_route_answers,
    compile_checker,
    reference_verdict,
    validate_checker,
)


class RecordingReporter:
    """In-memory Reporter replacement that records complete runner states."""

    instances = []
    joined = 0

    def __init__(self, base_url, token, run_id, *, dry_run=False):
        self.base_url = base_url
        self.token = token
        self.run_id = run_id
        self.dry_run = dry_run
        self.state = {}
        self.posts = []
        self.__class__.instances.append(self)

    def post(self, *, required=False, **changes):
        self.state.update(copy.deepcopy(changes))
        self.posts.append(copy.deepcopy(self.state))
        return {"ok": True}

    def snapshot(self):
        return {"audience": {"joined": self.joined}}


def runner_args(**changes):
    values = {
        "base_url": "https://example.test",
        "token_file": ".unused-token",
        "model": "qwen3:0.6b",
        "planner_model": "qwen3:8b",
        "base_attempts": 3,
        "max_attempts": 5,
        "workers": 2,
        "join_seconds": 0,
        "no_warmup": True,
        "warmup_only": False,
        "dry_run": True,
    }
    values.update(changes)
    return SimpleNamespace(**values)


def generated(answer=None, *, parse_error=None, seed=0):
    return {
        "seed": seed,
        "raw": "",
        "answer": answer,
        "parse_error": parse_error,
        "elapsed_s": 0.01,
        "eval_count": 1,
    }


def assert_api_count_invariants(test_case, state):
    test_case.assertLessEqual(state["checked"], state["generated"])
    test_case.assertLessEqual(state["generated"], state["candidate_target"])
    test_case.assertEqual(state["culled"] + state["survived"], state["checked"])
    test_case.assertEqual(set(state["rejection_counts"]), set(REJECTION_KEYS))
    test_case.assertEqual(sum(state["rejection_counts"].values()), state["culled"])
    if state["status"] in {"sampling", "checking", "success", "budget", "collapse"}:
        test_case.assertTrue(state["checker"]["known_good_passed"])
        test_case.assertTrue(state["checker"]["known_bad_rejected"])
        test_case.assertTrue(state["checker"]["locked"])


class ReporterSchemaTests(unittest.TestCase):
    def test_first_payload_has_exact_live_room_shape_and_sequence_zero(self):
        args = runner_args(base_attempts=3, max_attempts=8)
        reporter = live_demo.Reporter(
            args.base_url,
            "test-token",
            "test-run-138",
        )
        reporter.state = live_demo.initial_state(args, live_demo.time.perf_counter())
        with patch.object(live_demo, "request_json", return_value={"ok": True}) as request:
            reporter.post(required=True)
            first = request.call_args.args[1]
            reporter.post(
                status="planning",
                join_open=False,
                candidate_target=3,
                message="Planning.",
            )
            second = request.call_args.args[1]

        expected_keys = {
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
        }
        self.assertEqual(set(first), expected_keys)
        self.assertEqual(first["seq"], 0)
        self.assertEqual(first["candidate_target"], 8)
        self.assertEqual(second["seq"], 1)
        self.assertEqual(second["candidate_target"], 3)
        assert_api_count_invariants(self, second)


class RunnerFailureTests(unittest.TestCase):
    def setUp(self):
        RecordingReporter.instances = []
        RecordingReporter.joined = 0

    def run_with(self, args, *, checker, candidate_side_effect=None, compile_error=None):
        planner_result = {"text": "def check(answer):\n    return False"}
        compile_result = patch.object(live_demo, "compile_checker", return_value=checker)
        if compile_error is not None:
            compile_result = patch.object(live_demo, "compile_checker", side_effect=compile_error)
        with (
            patch.object(live_demo, "Reporter", RecordingReporter),
            patch.object(
                live_demo,
                "list_models",
                return_value={args.model, args.planner_model},
            ),
            patch.object(live_demo, "ollama_generate", return_value=planner_result),
            compile_result,
            patch.object(
                live_demo,
                "validate_checker",
                return_value={"good_probe": True, "bad_probe": True, "compared": 326},
            ),
            patch.object(live_demo, "generate_candidate", side_effect=candidate_side_effect),
            redirect_stdout(io.StringIO()),
            redirect_stderr(io.StringIO()),
        ):
            result = live_demo.run(args)
        return result, RecordingReporter.instances[-1]

    def test_collecting_declares_real_audience_cap_and_invalid_checker_is_error(self):
        args = runner_args(base_attempts=3, max_attempts=8)
        result, reporter = self.run_with(
            args,
            checker=None,
            compile_error=ValueError("known-bad probe passed"),
        )

        self.assertEqual(result, 2)
        self.assertEqual(reporter.posts[0]["status"], "collecting")
        self.assertEqual(reporter.posts[0]["candidate_target"], 8)
        self.assertEqual(reporter.posts[1]["candidate_target"], 3)
        final = reporter.posts[-1]
        self.assertEqual(final["status"], "error")
        self.assertFalse(final["checker"]["locked"])
        assert_api_count_invariants(self, final)

    def test_candidate_request_failure_reports_only_real_candidates(self):
        def candidate_result(model, seed):
            if seed == 1:
                raise RuntimeError("Ollama disconnected")
            return generated({"route": ["BASE", "D", "ROVER"]}, seed=seed)

        result, reporter = self.run_with(
            runner_args(base_attempts=3, max_attempts=3),
            checker=lambda answer: False,
            candidate_side_effect=candidate_result,
        )

        self.assertEqual(result, 2)
        final = reporter.posts[-1]
        self.assertEqual(final["status"], "error")
        self.assertEqual(final["generated"], 2)
        self.assertEqual(final["checked"], 0)
        self.assertIn("2 of 3", final["message"])
        assert_api_count_invariants(self, final)

    def test_checker_disagreement_reports_only_checked_prefix(self):
        result, reporter = self.run_with(
            runner_args(base_attempts=1, max_attempts=1),
            checker=lambda answer: False,
            candidate_side_effect=lambda model, seed: generated(GOOD_PROBE, seed=seed),
        )

        self.assertEqual(result, 2)
        final = reporter.posts[-1]
        self.assertEqual(final["status"], "error")
        self.assertEqual(final["generated"], 1)
        self.assertEqual(final["checked"], 0)
        self.assertEqual(final["culled"], 0)
        self.assertEqual(final["survived"], 0)
        self.assertIn("candidate 1", final["message"])
        assert_api_count_invariants(self, final)

    def test_empty_validated_pool_is_the_only_collapse_failure(self):
        bad_routes = (
            generated({"route": ["BASE", "D", "ROVER"]}, seed=0),
            generated({"route": ["BASE", "A", "D", "ROVER"]}, seed=1),
        )

        result, reporter = self.run_with(
            runner_args(base_attempts=2, max_attempts=2),
            checker=lambda answer: False,
            candidate_side_effect=lambda model, seed: bad_routes[seed],
        )

        self.assertEqual(result, 3)
        final = reporter.posts[-1]
        self.assertEqual(final["status"], "collapse")
        self.assertEqual(final["checked"], 2)
        self.assertEqual(final["culled"], 2)
        self.assertEqual(final["survived"], 0)
        assert_api_count_invariants(self, final)

    def test_success_state_and_phase_timing_path(self):
        result, reporter = self.run_with(
            runner_args(base_attempts=1, max_attempts=1),
            checker=lambda answer: answer == GOOD_PROBE,
            candidate_side_effect=lambda model, seed: generated(GOOD_PROBE, seed=seed),
        )

        self.assertEqual(result, 0)
        final = reporter.posts[-1]
        self.assertEqual(final["status"], "success")
        self.assertEqual(final["generated"], 1)
        self.assertEqual(final["checked"], 1)
        self.assertEqual(final["culled"], 0)
        self.assertEqual(final["survived"], 1)
        self.assertEqual(final["result"]["route"], GOOD_PROBE["route"])
        self.assertIn("after joins closed", final["message"])
        assert_api_count_invariants(self, final)


class RouteVerifierTests(unittest.TestCase):
    def test_exact_valid_routes(self):
        valid = {
            tuple(answer["route"])
            for answer in all_simple_route_answers()
            if reference_verdict(answer)[0] == "pass"
        }
        self.assertEqual(
            valid,
            {
                ("BASE", "A", "D", "E", "ROVER"),
                ("BASE", "B", "D", "ROVER"),
                ("BASE", "B", "D", "E", "ROVER"),
            },
        )

    def test_probe_suite(self):
        self.assertEqual(reference_verdict(GOOD_PROBE)[0], "pass")
        self.assertTrue(all(reference_verdict(probe)[0] != "pass" for probe in BAD_PROBES))

    def test_rejection_reasons_are_exercised(self):
        cases = {
            "wrong_shape": {"route": "BASE-B-ROVER"},
            "bad_endpoints": {"route": ["ROVER", "E", "D", "B", "BASE"]},
            "unknown_node": {"route": ["BASE", "X", "ROVER"]},
            "repeated_node": {"route": ["BASE", "B", "D", "B", "ROVER"]},
            "offline_node": {"route": ["BASE", "A", "C", "ROVER"]},
            "bad_hop": {"route": ["BASE", "D", "ROVER"]},
            "latency": {"route": ["BASE", "A", "D", "ROVER"]},
            "bandwidth": {"route": ["BASE", "B", "E", "ROVER"]},
        }
        for expected, answer in cases.items():
            with self.subTest(expected=expected):
                self.assertEqual(reference_verdict(answer)[0], expected)

    def test_generated_checker_gate(self):
        source = """
def check(answer):
    if not isinstance(answer, dict) or set(answer.keys()) != {'route'}:
        return False
    route = answer['route']
    allowed = {
        ('BASE','A'):(2,4), ('A','BASE'):(2,4),
        ('BASE','B'):(3,5), ('B','BASE'):(3,5),
        ('A','C'):(2,4), ('C','A'):(2,4),
        ('A','D'):(4,3), ('D','A'):(4,3),
        ('B','D'):(2,4), ('D','B'):(2,4),
        ('B','E'):(2,2), ('E','B'):(2,2),
        ('D','E'):(1,3), ('E','D'):(1,3),
        ('D','ROVER'):(4,3), ('ROVER','D'):(4,3),
        ('E','ROVER'):(2,4), ('ROVER','E'):(2,4),
        ('C','ROVER'):(1,5), ('ROVER','C'):(1,5)
    }
    if not isinstance(route, list) or len(route) < 2:
        return False
    if route[0] != 'BASE' or route[-1] != 'ROVER' or 'C' in route:
        return False
    if len(route) != len(set(route)):
        return False
    latency = 0
    bandwidth = 100
    for pair in zip(route, route[1:]):
        if pair not in allowed:
            return False
        latency += allowed[pair][0]
        bandwidth = min(bandwidth, allowed[pair][1])
    return latency <= 9 and bandwidth >= 3
"""
        checker = compile_checker(source)
        result = validate_checker(checker)
        self.assertTrue(result["good_probe"])
        self.assertTrue(result["bad_probe"])
        self.assertEqual(result["compared"], 326)

    def test_checker_gate_rejects_unsafe_code(self):
        with self.assertRaises(ValueError):
            compile_checker("def check(answer):\n    return open('/tmp/x').read()")


if __name__ == "__main__":
    unittest.main()
