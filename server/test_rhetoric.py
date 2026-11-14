"""Offline checks: python -m unittest server.test_rhetoric"""

import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from .rhetoric import AnalysisError, analyze_changes, evidence_passages


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


if __name__ == "__main__":
    unittest.main()
