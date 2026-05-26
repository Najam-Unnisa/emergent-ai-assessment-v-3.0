"""HireFast Backend regression tests (pytest).

Covers:
- Public meta endpoint
- Candidate test flow (start, response, conversation, complete)
- Admin auth + JWT guard
- Admin Dashboard, Questions CRUD, Candidates, HR review, Settings
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

# Load frontend .env for REACT_APP_BACKEND_URL (public ingress URL)
load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASS = "admin123"

REQ_TIMEOUT = 60  # AI scoring can take a while


# --------------- Fixtures ---------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def admin_token(s):
    r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS}, timeout=REQ_TIMEOUT)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
    return data["token"]


@pytest.fixture(scope="session")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def started_session(s):
    """Create a fresh candidate + session once per test session."""
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/test/start", json={"name": "TEST Candidate", "email": email}, timeout=REQ_TIMEOUT)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "sessionId" in data
    assert "sections" in data and isinstance(data["sections"], list) and len(data["sections"]) > 0
    return {"email": email, **data}


# --------------- Public meta ---------------
class TestMeta:
    def test_meta_sections_returns_21(self, s):
        r = s.get(f"{API}/meta/sections", timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 21
        keys = {x["key"] for x in data}
        for required in ["repetition", "vocabulary", "typing", "conversation", "interview", "paraphrasing"]:
            assert required in keys
        # validate structure
        for x in data:
            assert "key" in x and "name" in x and "type" in x
            assert "isEnabled" in x and "timerSeconds" in x and "questionsPerSession" in x


# --------------- Candidate flow ---------------
class TestCandidateFlow:
    def test_start_test_creates_session(self, started_session):
        sections = started_session["sections"]
        # sanity: each entry has questionId + data + sectionType
        for sec in sections:
            assert "sectionType" in sec
            assert "questionId" in sec
            assert "data" in sec

    def test_start_test_returns_existing_session_for_same_email(self, s, started_session):
        r = s.post(
            f"{API}/test/start",
            json={"name": "TEST Candidate", "email": started_session["email"]},
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["sessionId"] == started_session["sessionId"], "Existing in-progress session should be reused"

    def test_save_response_vocabulary(self, s, started_session):
        # find a vocabulary question
        vocab = next((x for x in started_session["sections"] if x["sectionType"] == "vocabulary"), None)
        assert vocab, "vocabulary section missing in start payload"
        r = s.post(f"{API}/test/response", json={
            "sessionId": started_session["sessionId"],
            "questionId": vocab["questionId"],
            "sectionType": "vocabulary",
            "selectedOption": vocab["data"].get("correctAnswer", "affect"),
        }, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_save_response_typing(self, s, started_session):
        typ = next((x for x in started_session["sections"] if x["sectionType"] == "typing"), None)
        assert typ, "typing section missing"
        r = s.post(f"{API}/test/response", json={
            "sessionId": started_session["sessionId"],
            "questionId": typ["questionId"],
            "sectionType": "typing",
            "typedText": "The meeting has been rescheduled.",
            "wpm": 55.4,
            "accuracyPercentage": 92.0,
            "errorCount": 3,
        }, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_save_response_repetition(self, s, started_session):
        rep = next((x for x in started_session["sections"] if x["sectionType"] == "repetition"), None)
        assert rep, "repetition section missing"
        r = s.post(f"{API}/test/response", json={
            "sessionId": started_session["sessionId"],
            "questionId": rep["questionId"],
            "sectionType": "repetition",
            "transcript": "The quarterly report was submitted before the deadline.",
        }, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_response_upsert_idempotent(self, s, started_session):
        # repeat the vocabulary save and ensure no error and no duplicate
        vocab = next((x for x in started_session["sections"] if x["sectionType"] == "vocabulary"), None)
        for _ in range(2):
            r = s.post(f"{API}/test/response", json={
                "sessionId": started_session["sessionId"],
                "questionId": vocab["questionId"],
                "sectionType": "vocabulary",
                "selectedOption": "wrong-option",
            }, timeout=REQ_TIMEOUT)
            assert r.status_code == 200

    def test_conversation_endpoint_calls_claude(self, s, started_session):
        conv = next((x for x in started_session["sections"] if x["sectionType"] == "conversation"), None)
        assert conv, "conversation section missing"
        d = conv["data"]
        r = s.post(f"{API}/test/conversation", json={
            "sessionId": started_session["sessionId"],
            "questionId": conv["questionId"],
            "scenarioId": conv["questionId"],
            "sectionType": "conversation",
            "candidateMessage": "I would like to take 3 days of casual leave next week to attend a family function.",
            "history": [],
            "title": d.get("title", "Applying for Leave"),
            "context": d.get("context", "Employee requesting leave."),
            "role": d.get("role", "manager"),
        }, timeout=REQ_TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "reply" in data and isinstance(data["reply"], str) and len(data["reply"]) > 0

    def test_complete_test_returns_scoring(self, s, started_session):
        r = s.post(
            f"{API}/test/complete",
            json={"sessionId": started_session["sessionId"]},
            timeout=120,  # Claude scoring may take ~5-15s
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "overallScore" in data
        assert "sectionScores" in data
        assert "overallFeedback" in data
        assert isinstance(data["overallScore"], (int, float))


# --------------- Admin auth ---------------
class TestAdminAuth:
    def test_admin_login_success(self, admin_token):
        assert admin_token

    def test_admin_login_wrong_password(self, s):
        r = s.post(f"{API}/admin/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=REQ_TIMEOUT)
        assert r.status_code == 401

    def test_admin_routes_require_jwt(self, s):
        # plain session without token
        bare = requests.Session()
        for path in ["/admin/dashboard", "/admin/questions", "/admin/candidates", "/admin/settings"]:
            r = bare.get(f"{API}{path}", timeout=REQ_TIMEOUT)
            assert r.status_code in (401, 403), f"{path} should require auth, got {r.status_code}"


# --------------- Admin: Dashboard ---------------
class TestDashboard:
    def test_dashboard(self, s, admin_headers):
        r = s.get(f"{API}/admin/dashboard", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        for k in ("totalCandidates", "testsToday", "avgScore", "pendingHrReviews", "avgBySection", "recentCandidates"):
            assert k in d
        assert isinstance(d["avgBySection"], list) and len(d["avgBySection"]) == 21
        assert isinstance(d["recentCandidates"], list)


# --------------- Admin: Questions CRUD ---------------
class TestQuestionsCrud:
    created_id = None

    def test_list_questions_by_section(self, s, admin_headers):
        r = s.get(f"{API}/admin/questions?sectionType=repetition", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        assert all(x["sectionType"] == "repetition" for x in items)

    def test_create_update_delete_question(self, s, admin_headers):
        # CREATE
        payload = {
            "sectionType": "vocabulary",
            "difficulty": "medium",
            "isActive": True,
            "orderIndex": 99,
            "data": {
                "sentence": "TEST_ Please _____ this word.",
                "options": ["select", "elect", "neglect", "reject"],
                "correctAnswer": "select",
            },
        }
        r = s.post(f"{API}/admin/questions", headers=admin_headers, json=payload, timeout=REQ_TIMEOUT)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["sectionType"] == "vocabulary"
        qid = created["id"]
        TestQuestionsCrud.created_id = qid

        # GET to verify persistence
        list_r = s.get(f"{API}/admin/questions?sectionType=vocabulary", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert any(x["id"] == qid for x in list_r.json())

        # UPDATE
        upd = {**payload, "data": {**payload["data"], "sentence": "TEST_ updated sentence _____."}}
        r2 = s.put(f"{API}/admin/questions/{qid}", headers=admin_headers, json=upd, timeout=REQ_TIMEOUT)
        assert r2.status_code == 200
        assert "updated" in r2.json()["data"]["sentence"]

        # DELETE
        r3 = s.delete(f"{API}/admin/questions/{qid}", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert r3.status_code == 200
        # verify gone
        list_r2 = s.get(f"{API}/admin/questions?sectionType=vocabulary", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert not any(x["id"] == qid for x in list_r2.json())


# --------------- Admin: Candidates ---------------
class TestCandidates:
    def test_list_candidates(self, s, admin_headers, started_session):
        r = s.get(f"{API}/admin/candidates", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list) and len(items) >= 1
        assert any(x["id"] == started_session["sessionId"] for x in items)

    def test_candidate_detail(self, s, admin_headers, started_session):
        sid = started_session["sessionId"]
        r = s.get(f"{API}/admin/candidates/{sid}", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        d = r.json()
        assert "session" in d and d["session"]["id"] == sid
        assert "responses" in d and isinstance(d["responses"], list)
        assert "conversations" in d
        assert "sectionMeta" in d


# --------------- Admin: HR Review ---------------
class TestHrReview:
    def test_save_hr_review(self, s, admin_headers, started_session):
        sid = started_session["sessionId"]
        # find a saved response questionId
        det = s.get(f"{API}/admin/candidates/{sid}", headers=admin_headers, timeout=REQ_TIMEOUT).json()
        responses = det.get("responses", [])
        assert len(responses) >= 1
        per = [{"questionId": responses[0]["questionId"], "hrScore": 15, "hrComment": "TEST_ good"}]
        r = s.put(
            f"{API}/admin/hr-review/{sid}",
            headers=admin_headers,
            json={"hrNotes": "TEST_ overall good", "perResponse": per},
            timeout=REQ_TIMEOUT,
        )
        assert r.status_code == 200
        # verify status flipped
        det2 = s.get(f"{API}/admin/candidates/{sid}", headers=admin_headers, timeout=REQ_TIMEOUT).json()
        assert det2["session"]["hrStatus"] == "reviewed"
        assert det2["session"]["hrNotes"] == "TEST_ overall good"


# --------------- Admin: Settings ---------------
class TestSettings:
    def test_get_settings_21(self, s, admin_headers):
        r = s.get(f"{API}/admin/settings", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 21
        for it in items:
            for k in ("sectionType", "isEnabled", "timerSeconds", "questionsPerSession"):
                assert k in it

    def test_bulk_update_then_reset(self, s, admin_headers):
        cur = s.get(f"{API}/admin/settings", headers=admin_headers, timeout=REQ_TIMEOUT).json()
        # bump one section's timer
        target = cur[0]["sectionType"]
        payload = [
            {
                "sectionType": x["sectionType"],
                "isEnabled": x["isEnabled"],
                "timerSeconds": (x["timerSeconds"] + 5) if x["sectionType"] == target else x["timerSeconds"],
                "questionsPerSession": x["questionsPerSession"],
            }
            for x in cur
        ]
        r = s.put(f"{API}/admin/settings", headers=admin_headers, json=payload, timeout=REQ_TIMEOUT)
        assert r.status_code == 200
        upd = s.get(f"{API}/admin/settings", headers=admin_headers, timeout=REQ_TIMEOUT).json()
        new_timer = next(x["timerSeconds"] for x in upd if x["sectionType"] == target)
        old_timer = next(x["timerSeconds"] for x in cur if x["sectionType"] == target)
        assert new_timer == old_timer + 5

        # RESET
        rr = s.post(f"{API}/admin/settings/reset", headers=admin_headers, timeout=REQ_TIMEOUT)
        assert rr.status_code == 200
        post_reset = s.get(f"{API}/admin/settings", headers=admin_headers, timeout=REQ_TIMEOUT).json()
        reset_timer = next(x["timerSeconds"] for x in post_reset if x["sectionType"] == target)
        default_timer = next(x["defaultTimer"] for x in post_reset if x["sectionType"] == target)
        assert reset_timer == default_timer
