# Semgrep rule tests for ../semgrep-rules/timing-safe-compare.yml (Python).
# Never imported or executed.
import hashlib
import hmac


def verify(header, payload, sig, secret):
    expected = hmac.new(secret, f"{header}.{payload}".encode(), hashlib.sha256).hexdigest()
    # ruleid: timing-unsafe-digest-compare-py
    if sig != expected:
        return False
    # ok: timing-unsafe-digest-compare-py
    return hmac.compare_digest(sig, expected)


def inline(body, mac, key):
    # ruleid: timing-unsafe-digest-compare-py, timing-unsafe-secret-compare-py
    return mac == hmac.new(key, body, hashlib.sha256).hexdigest()


def names(user, body, token, api_key, x):
    # ruleid: timing-unsafe-secret-compare-py
    if user.password == body.password:
        return 1
    # ruleid: timing-unsafe-secret-compare-py
    if x != api_key:
        return 2
    # ok: timing-unsafe-secret-compare-py
    if token == None:  # noqa: E711
        return 3
    # ok: timing-unsafe-secret-compare-py
    if len(token) != 32:
        return 4
    return 0
