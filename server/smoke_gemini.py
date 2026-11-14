"""Opt-in live smoke test: .venv/bin/python -m server.smoke_gemini"""

import json

from .rhetoric import AnalysisError, analyze_changes


def main() -> None:
    try:
        result = analyze_changes("Smoke test (synthetic excerpts)", [{
            "kind": "modified",
            "oldText": "The government introduced the policy in 1998.",
            "newText": "The reckless government imposed the disastrous policy in 1998.",
        }])
    except AnalysisError as exc:
        raise SystemExit(f"FAIL: {exc}") from None
    # analyze_changes validates the JSON schema and requires every input index.
    assert result["model"] and len(result["changes"]) == 1
    assert result["changes"][0]["explanation"].strip()
    print(f"PASS: real Gemini request and structured JSON validation ({result['model']}).")
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
