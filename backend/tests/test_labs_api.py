"""Backend regression tests for the Labs MVP API."""
import os
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or os.environ.get("EXPO_BACKEND_URL")
    or "https://athlete-baseline.preview.emergentagent.com"
).rstrip("/")

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- Root / health -------------------------------------------- #
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200, r.text
    assert r.json().get("app") == "Labs"


# ---------------- Today --------------------------------------------------- #
class TestToday:
    def test_today_shape(self, s):
        r = s.get(f"{API}/today")
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("date", "readiness", "narrative", "drivers", "signals", "sovereignty"):
            assert k in body, f"missing {k}"
        readiness = body["readiness"]
        assert 0 <= readiness["score"] <= 100
        assert readiness["verdict"] in ("train_hard", "moderate", "recover")
        assert {"low", "mid", "high"} <= set(readiness["band"].keys())
        assert isinstance(readiness["history"], list) and len(readiness["history"]) > 0
        # Signals: must have hrv, sleep, load, siga (4 cards)
        keys = {sig["key"] for sig in body["signals"]}
        assert keys == {"hrv", "sleep", "load", "siga"}, keys
        for sig in body["signals"]:
            assert {"low", "mid", "high"} <= set(sig["band"].keys())
            assert isinstance(sig["value"], (int, float))
        assert len(body["drivers"]) >= 4
        assert body["sovereignty"]["region"] == "France"


# ---------------- Biomarkers ---------------------------------------------- #
@pytest.mark.parametrize(
    "metric,unit",
    [
        ("siga", "µg/mL"),
        ("cortisol", "nmol/L"),
        ("testosterone", "pg/mL"),
        ("creatinine", "mg/dL"),
    ],
)
def test_biomarker_endpoints(s, metric, unit):
    r = s.get(f"{API}/biomarkers/{metric}")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["metric"] == metric
    assert body["unit"] == unit
    assert {"low", "mid", "high"} <= set(body["band"].keys())
    assert len(body["series"]) >= 20, f"expected ~32 points, got {len(body['series'])}"
    assert len(body["training_load"]) >= 50, f"expected ~70 points, got {len(body['training_load'])}"
    assert "value" in body["latest"]
    assert body["position"] in ("below", "in", "above")


def test_biomarker_invalid_returns_422(s):
    r = s.get(f"{API}/biomarkers/glucose")
    assert r.status_code == 422


# ---------------- Trends -------------------------------------------------- #
@pytest.mark.parametrize("rng,min_len", [("2w", 10), ("6w", 30), ("3m", 70)])
def test_trends(s, rng, min_len):
    r = s.get(f"{API}/trends", params={"range": rng})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["range"] == rng
    metrics = body["metrics"]
    kinds = {m["kind"] for m in metrics}
    assert "wearable" in kinds and "biomarker" in kinds
    for m in metrics:
        assert {"low", "mid", "high"} <= set(m["band"].keys())
        if m["kind"] == "wearable":
            assert len(m["series"]) >= min_len, f"{m['key']} short: {len(m['series'])}"


# ---------------- Invie --------------------------------------------------- #
class TestInvie:
    def test_insight(self, s):
        r = s.post(f"{API}/invie/insight", json={})
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("narrative", "verdict", "score", "drivers", "confidence"):
            assert k in body
        assert body["verdict"] in ("train_hard", "moderate", "recover")
        assert isinstance(body["narrative"], str) and len(body["narrative"]) > 10

    @pytest.mark.parametrize(
        "msg,must_contain",
        [
            ("why is my readiness low", "readiness"),
            ("what does my siga mean", "sIgA"),
            ("should I train hard today", None),  # any train/recovery answer
        ],
    )
    def test_chat_intents(self, s, msg, must_contain):
        r = s.post(f"{API}/invie/chat", json={"message": msg})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "reply" in body and len(body["reply"]) > 5
        assert body["verdict"] in ("train_hard", "moderate", "recover")
        if must_contain:
            assert must_contain.lower() in body["reply"].lower(), body["reply"]

    def test_chat_empty_message_rejected(self, s):
        r = s.post(f"{API}/invie/chat", json={"message": ""})
        assert r.status_code == 422


# ---------------- Vault --------------------------------------------------- #
class TestVault:
    def test_vault_sources(self, s):
        r = s.get(f"{API}/vault/sources")
        assert r.status_code == 200, r.text
        body = r.json()
        sov = body["sovereignty"]
        assert sov["region"] == "France"
        assert "RGPD" in sov["compliance"]
        ids = {src["id"] for src in body["sources"]}
        assert ids == {"apple_health", "labs_device", "manual"}
        assert body["totals"]["daily_metrics"] > 0
        assert body["totals"]["biomarker_readings"] > 0


# ---------------- Onboarding (must run last; mutates state) --------------- #
class TestOnboarding:
    def test_onboarding_updates_athlete_and_apple_health(self, s):
        payload = {
            "name": "TEST_Athlete",
            "sport": "Trail running",
            "goal": "TEST goal",
            "connect_apple_health": True,
        }
        r = s.post(f"{API}/onboarding", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        # verify persistence via /api/athlete
        r2 = s.get(f"{API}/athlete")
        assert r2.status_code == 200
        assert r2.json()["athlete"]["name"] == "TEST_Athlete"

        # verify Apple Health source flipped to connected
        r3 = s.get(f"{API}/vault/sources")
        ah = next(x for x in r3.json()["sources"] if x["id"] == "apple_health")
        assert ah["status"] == "connected"

    def test_onboarding_validates_input(self, s):
        r = s.post(f"{API}/onboarding", json={"name": "", "sport": "x", "goal": "y"})
        assert r.status_code == 422

    def teardown_method(self, method):
        # restore demo name for later runs
        try:
            requests.post(
                f"{API}/onboarding",
                json={
                    "name": "Léa Moreau",
                    "sport": "Trail running",
                    "goal": "100K Ultra · September",
                    "connect_apple_health": True,
                },
                timeout=10,
            )
        except Exception:
            pass
