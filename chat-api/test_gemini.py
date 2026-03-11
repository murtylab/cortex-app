#!/usr/bin/env python3
"""Test Gemini client or POST /api/gemini. From chat-api/: python test_gemini.py [--url http://127.0.0.1:8000] [--list-models]"""
from __future__ import annotations

import argparse
import json
import os
import sys


def _load_dotenv() -> None:
    """If .env exists in script dir, set GEMINI_API_KEY/GOOGLE_API_KEY from it."""
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.isfile(env_path):
        return
    for line in open(env_path):
        line = line.strip()
        if line.startswith("GEMINI_API_KEY=") or line.startswith("GOOGLE_API_KEY="):
            k, _, v = line.partition("=")
            v = v.strip().strip('"').strip("'")
            if v and k not in os.environ:
                os.environ[k] = v


def test_client(verbose: bool = False) -> bool:
    """Test get_gemini_reply directly. Returns True if success."""
    _load_dotenv()
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key or not key.strip():
        print("Set GEMINI_API_KEY (or GOOGLE_API_KEY) and re-run.", file=sys.stderr)
        return False

    test_message = "In one sentence, what is the Virtual Visual Cortex Lab?"
    print(f"Query: {test_message}")

    if verbose:
        import google.generativeai as genai
        genai.configure(api_key=key.strip())
        model_id = os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")
        model = genai.GenerativeModel(model_id)
        response = model.generate_content("Say hello in 5 words.")
        print(f"Reply: {response.text.strip()}")
        return True

    from gemini_client import get_gemini_reply
    reply = get_gemini_reply(test_message)
    if reply is None:
        print("FAIL: get_gemini_reply returned None. Run with --verbose to see the real error.", file=sys.stderr)
        return False
    print(f"Reply: {reply}")
    if len(reply.strip()) < 10:
        print("WARN: reply seems too short.", file=sys.stderr)
    return True


def test_http(base_url: str) -> bool:
    """Test POST /api/gemini. Returns True if success."""
    try:
        import urllib.request
    except ImportError:
        print("urllib.request not available.", file=sys.stderr)
        return False

    url = base_url.rstrip("/") + "/api/gemini"
    body = json.dumps({"message": "In one sentence, what is the Virtual Visual Cortex Lab?"}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return False

    reply = data.get("reply")
    if not reply:
        print("FAIL: response has no 'reply'.", file=sys.stderr)
        return False
    print("Reply:", reply)
    return True


def list_models() -> bool:
    """List models that support generateContent. Returns True if success."""
    _load_dotenv()
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key or not key.strip():
        print("Set GEMINI_API_KEY (or GOOGLE_API_KEY) and re-run.", file=sys.stderr)
        return False
    import google.generativeai as genai
    genai.configure(api_key=key.strip())
    print("Models that support generate_content:")
    for m in genai.list_models():
        if "generateContent" in (m.supported_generation_methods or []):
            print(f"  {m.name}")
    return True


def main() -> None:
    ap = argparse.ArgumentParser(description="Test Gemini client or /api/gemini endpoint")
    ap.add_argument("--url", default="", help="Base URL of API (e.g. http://127.0.0.1:8000) to test HTTP endpoint")
    ap.add_argument("--verbose", "-v", action="store_true", help="Call Gemini directly and show exceptions")
    ap.add_argument("--list-models", action="store_true", help="List available model names; set GEMINI_MODEL to one of them")
    args = ap.parse_args()

    if args.list_models:
        ok = list_models()
    elif args.url:
        ok = test_http(args.url)
    else:
        ok = test_client(verbose=args.verbose)

    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
