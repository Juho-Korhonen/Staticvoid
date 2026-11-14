"""Offline checks: python -m unittest server.test_rhetoric"""

import json
import os
import unittest
from threading import Barrier, Event, Lock
from types import SimpleNamespace
from unittest.mock import patch
from google.genai import errors

from .diff import diff_texts
from .rhetoric import AnalysisError, analyze_changes, evidence_passages, iter_analysis, prepare_changes, revision_changes


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.source = [{"kind": "modified", "oldText": "A policy was introduced.",
                        "newText": "A disastrous policy was imposed."}]
        self.response = {
            "summary": "The later wording adds negative judgment.",
            "overallNeutrality": "less_neutral",
            "possibleAgenda": "The wording may encourage opposition to the policy.",
            "changes": [{
                "changeIndex": 0, "toneDelta": -1, "hedgeAdded": False,
                "flags": ["loaded_language"], "severity": "medium",
                "possibleAgenda": "The wording may encourage opposition to the policy.",
                "neutrality": "less_neutral", "explanation": "Disastrous adds negative judgment.",
                "evidenceBeforeId": "0-before-0", "evidenceAfterId": "0-after-0",
                "framingChanges": ["Negative framing"], "neutralWording": "A policy was introduced.",
            }],
        }
        env = patch.dict(os.environ, {"GEMINI_API_KEY": "test-placeholder"})
        env.start()
        self.addCleanup(env.stop)
        client = patch("server.rhetoric.genai.Client")
        self.factory = client.start()
        self.addCleanup(client.stop)
        self.generate = self.factory.return_value.__enter__.return_value.models.generate_content

    def analyze(self):
        self.generate.return_value = SimpleNamespace(text=json.dumps(self.response))
        return analyze_changes("Test", self.source, {"revisions": 5, "editors": 3})

    def test_original_evidence_and_multiple_editor_context(self):
        result = self.analyze()
        self.assertEqual(result["changes"][0]["oldText"], self.source[0]["oldText"])
        self.assertEqual(result["changes"][0]["evidenceAfter"], self.source[0]["newText"])
        sent = json.loads(self.generate.call_args.kwargs["contents"])
        self.assertEqual(sent["revisionContext"], {"revisions": 5, "editors": 3})

    def test_missing_or_invalid_evidence_is_rejected(self):
        for passage_id in ("0-after-999", "0-before-0", "invented quotation"):
            with self.subTest(passage_id=passage_id):
                self.response["changes"][0]["evidenceAfterId"] = passage_id
                with self.assertRaises(AnalysisError):
                    self.analyze()

    def test_evidence_preserves_wikitext_and_unicode(self):
        text = ('Suomen ”talvisota”\t[[Suomi|Suomen]]  historia.\n' * 20) + 'a' * 240
        for passage in evidence_passages(text):
            self.assertIn(passage, text)
            self.assertLessEqual(len(passage), 200)
        self.assertEqual(''.join(evidence_passages(text)), text)

    def test_missing_and_duplicate_findings_are_rejected(self):
        finding = self.response["changes"][0]
        for findings in ([], [finding, finding]):
            self.response["changes"] = findings
            with self.assertRaises(AnalysisError):
                self.analyze()

    def test_unchanged_text_needs_no_request_or_key(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            result = analyze_changes("Test", [])
        self.assertEqual(result["overallNeutrality"], "unchanged")
        self.assertIsNone(result["possibleAgenda"])
        self.factory.assert_not_called()

    def respond_to_batch(self, **kwargs):
        changes = json.loads(kwargs["contents"])["changes"]
        return SimpleNamespace(text=json.dumps({"changes": [{
            **self.response["changes"][0], "changeIndex": change["changeIndex"],
            "evidenceBeforeId": next(iter(change["beforePassages"]), None),
            "evidenceAfterId": next(iter(change["afterPassages"]), None),
        } for change in changes]}))

    def test_all_changes_beyond_first_batch_are_inspected(self):
        self.generate.side_effect = self.respond_to_batch
        result = analyze_changes("Test", self.source * 27)
        self.assertEqual(len(result["changes"]), 27)
        self.assertEqual(self.generate.call_count, 3)
        self.assertEqual(result["coverage"]["reviewedChanges"], 27)
        self.assertEqual(result["coverage"]["completedBatches"], 3)
        self.assertFalse(result["partial"])
        sent = [json.loads(call.kwargs["contents"])["changes"] for call in self.generate.call_args_list]
        self.assertEqual(sorted(c["changeIndex"] for batch in sent for c in batch), list(range(27)))
        schema = self.generate.call_args.kwargs['config'].response_json_schema
        self.assertNotIn('minItems', schema['properties']['changes'])
        self.assertNotIn('maxItems', schema['properties']['changes'])

    def test_rejected_batch_splits_without_losing_changes(self):
        def respond(**kwargs):
            batch = json.loads(kwargs['contents'])['changes']
            if len(batch) > 4:
                raise errors.ClientError(400, {'error': {'message': 'Request contains an invalid argument.'}})
            return self.respond_to_batch(**kwargs)
        self.generate.side_effect = respond
        result = analyze_changes('Test', self.source * 27)
        self.assertEqual([c['changeIndex'] for c in result['changes']], list(range(27)))
        self.assertEqual(result['coverage']['reviewedChanges'], 27)
        self.assertEqual(result['coverage']['completedBatches'], result['coverage']['totalBatches'])
        self.assertGreater(result['coverage']['totalBatches'], 3)

    def test_four_concurrent_requests_keep_coverage_and_result_order(self):
        first_wave = Barrier(4)
        release_first = Event()
        lock = Lock()
        active = peak = 0

        def respond(**kwargs):
            nonlocal active, peak
            first_index = json.loads(kwargs['contents'])['changes'][0]['changeIndex']
            with lock:
                active += 1
                peak = max(peak, active)
            try:
                if first_index < 48:
                    first_wave.wait(timeout=5)
                if first_index == 0:
                    self.assertTrue(release_first.wait(timeout=5))
                return self.respond_to_batch(**kwargs)
            finally:
                with lock:
                    active -= 1

        self.generate.side_effect = respond
        source = [{**self.source[0], 'revision': {'id': i // 24}} for i in range(60)]
        events = iter_analysis('Test', source, {'revisions': 3})
        try:
            self.assertEqual(next(events)['reviewedChanges'], 0)
            # Other batches report progress even while the first request is blocked.
            progress = next(events)
            self.assertEqual(progress['reviewedChanges'], 12)
            self.assertEqual(progress['reviewedRevisions'], 0)
            release_first.set()
            remaining = list(events)
        finally:
            release_first.set()
            events.close()
        result = remaining[-1]['analysis']
        self.assertEqual(peak, 4)
        self.assertEqual(self.generate.call_count, 5)
        self.assertEqual([c['changeIndex'] for c in result['changes']], list(range(60)))
        self.assertEqual(result['coverage']['reviewedRevisions'], 3)
        self.assertEqual(result['coverage']['completedBatches'], 5)
        counts = [e['reviewedChanges'] for e in remaining if e['type'] == 'progress']
        self.assertEqual(counts, sorted(counts))
        self.assertEqual(counts[-1], 60)

    def test_invalid_key_stops_after_in_flight_requests(self):
        self.generate.side_effect = errors.ClientError(400, {'error': {'message': 'API key not valid.'}})
        with self.assertRaisesRegex(AnalysisError, 'rejected the API key'):
            analyze_changes('Test', self.source * 60)
        self.assertGreaterEqual(self.generate.call_count, 1)
        self.assertLessEqual(self.generate.call_count, 4)

    def test_rate_limit_stops_without_retrying_or_reporting_completion(self):
        self.generate.side_effect = errors.ClientError(429, {'error': {'message': 'Quota exceeded.'}})
        events = []
        with self.assertRaises(AnalysisError) as caught:
            events.extend(iter_analysis('Test', self.source * 60))
        self.assertEqual(caught.exception.status_code, 429)
        self.assertLessEqual(self.generate.call_count, 4)
        self.assertFalse(any(e['type'] == 'complete' for e in events))

    def test_long_changes_keep_the_tail_and_boundary_context(self):
        text = 'a' * 5995 + 'boundary evidence ' + 'b' * 8000 + 'tail evidence'
        prepared = prepare_changes([{"kind": "added", "oldText": None, "newText": text}])
        self.assertGreater(len(prepared), 1)
        self.assertTrue(any('boundary evidence' in p['newText'] for p in prepared))
        self.assertTrue(any('tail evidence' in p['newText'] for p in prepared))
        for start in range(0, len(text), 100):
            self.assertTrue(any(text[start:start + 100] in p['newText'] for p in prepared))
        self.generate.side_effect = self.respond_to_batch
        result = analyze_changes("Test", [{"kind": "added", "oldText": None, "newText": text}])
        self.assertEqual(len(result["changes"]), len(prepared))

    def test_failed_later_batch_never_reports_completion(self):
        first_reviewed = Event()
        def respond(**kwargs):
            first_index = json.loads(kwargs['contents'])['changes'][0]['changeIndex']
            if first_index == 12:
                self.assertTrue(first_reviewed.wait(timeout=5))
                return SimpleNamespace(text='invalid JSON')
            return self.respond_to_batch(**kwargs)
        self.generate.side_effect = respond
        events = []
        with self.assertRaisesRegex(AnalysisError, '12/13 passages reviewed'):
            for event in iter_analysis('Test', self.source * 13):
                events.append(event)
                if event['reviewedChanges'] == 12:
                    first_reviewed.set()
        self.assertFalse(any(e['type'] == 'complete' for e in events))
        self.assertEqual(events[-1]['reviewedChanges'], 12)

    def test_closing_review_stops_subsequent_batches(self):
        self.generate.side_effect = self.respond_to_batch
        events = iter_analysis('Test', self.source * 60)
        next(events)
        next(events)
        events.close()
        self.assertGreaterEqual(self.generate.call_count, 1)
        self.assertLessEqual(self.generate.call_count, 4)

    def test_reverted_edit_is_reviewed_even_when_net_diff_is_empty(self):
        good, bad = 'The policy was introduced.', 'The policy was introduced. Everyone here is an idiot!'
        revisions = []
        for rev_id, before_id, before, after, revert in ((11, 10, good, bad, False), (12, 11, bad, good, True)):
            revisions.append({
                'rev_id': rev_id, 'before_rev_id': before_id, 'timestamp': '2015-01-02T00:00:00Z',
                'comment': '', 'is_revert': revert, 'revert_to_rev_id': 10 if revert else None,
                **diff_texts(before, after),
            })
        history = {'revisions': revisions, 'summary': {'revisions': 2}, 'truncated': False,
                   'net_change': diff_texts(good, good)}
        self.assertEqual(history['net_change']['blocks'], [])
        changes = revision_changes(history)
        self.generate.side_effect = self.respond_to_batch
        result = analyze_changes('Test', changes, {'revisions': 2, 'editors': 2})
        sent = json.loads(self.generate.call_args.kwargs['contents'])['changes']
        self.assertEqual([c['revision']['id'] for c in sent], [11, 12])
        self.assertTrue(sent[1]['revision']['isRevert'])
        self.assertEqual(result['coverage']['reviewedRevisions'], 2)
        self.assertEqual(result['changes'][0]['sources']['diff'], 'https://fi.wikipedia.org/w/index.php?oldid=10&diff=11')
        self.assertEqual(result['changes'][1]['sources']['diff'], 'https://fi.wikipedia.org/w/index.php?oldid=11&diff=12')

    def test_truncated_history_is_not_accepted_as_complete(self):
        with self.assertRaises(AnalysisError):
            revision_changes({'revisions': [], 'summary': {'revisions': 200}, 'truncated': True})


if __name__ == "__main__":
    unittest.main()
