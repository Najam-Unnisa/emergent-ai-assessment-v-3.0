"""HireFast - English Proficiency Test Backend (FastAPI + Motor + Claude)."""
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os
import uuid
import logging
import random
import json
import re
import asyncio
import bcrypt
import jwt as pyjwt


# from emergentintegrations.llm.chat import LlmChat, UserMessage

from seed_data import SECTIONS, QUESTIONS_POOL

import logging

logger = logging.getLogger(__name__)
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
SMTP_EMAIL = os.getenv("SMTP_EMAIL")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALG = "HS256"
JWT_EXP_HOURS = 24 * 7
CLAUDE_MODEL = "claude-sonnet-4-5-20250929"
app = FastAPI(title="HireFast API")
api = APIRouter(prefix="/api")
bearer = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
log = logging.getLogger("hirefast")


# ----------------- Models -----------------
class CandidateStart(BaseModel):
    name: str
    email: EmailStr


class ResponseSave(BaseModel):
    sessionId: str
    questionId: str
    sectionType: str
    transcript: Optional[str] = None
    selectedOption: Optional[str] = None
    typedText: Optional[str] = None
    wpm: Optional[float] = None
    accuracyPercentage: Optional[float] = None
    errorCount: Optional[int] = None
    extra: Optional[Dict[str, Any]] = None


class ConversationTurn(BaseModel):
    sessionId: str
    questionId: str
    scenarioId: str
    sectionType: str
    candidateMessage: str
    history: List[Dict[str, str]] = []
    title: str
    context: str
    role: str


class CompleteRequest(BaseModel):
    sessionId: str


class AdminLogin(BaseModel):
    email: EmailStr
    password: str


class QuestionUpsert(BaseModel):
    id: Optional[str] = None
    sectionType: str
    difficulty: Optional[str] = "medium"
    isActive: bool = True
    orderIndex: Optional[int] = 0
    data: Dict[str, Any] = {}


class HrReviewSave(BaseModel):
    hrNotes: str = ""
    perResponse: List[Dict[str, Any]] = []


class SettingsUpsert(BaseModel):
    sectionType: str
    isEnabled: bool
    timerSeconds: int
    questionsPerSession: int


# ----------------- Helpers -----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def make_token(payload: Dict[str, Any]) -> str:
    payload = {**payload, "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXP_HOURS)}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def admin_required(creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer)):
    if not creds or not creds.credentials:
        raise HTTPException(status_code=401, detail="Missing token")
    try:
        payload = pyjwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Forbidden")
    return payload


def fy_shuffle(items: list) -> list:
    arr = list(items)
    for i in range(len(arr) - 1, 0, -1):
        j = random.randint(0, i)
        arr[i], arr[j] = arr[j], arr[i]
    return arr


def pick_random(arr: list, n: int) -> list:
    return fy_shuffle(arr)[:max(0, min(n, len(arr)))]


def serialize_question(q: Dict[str, Any]) -> Dict[str, Any]:
    """Strip internal fields and return safe payload for candidate."""
    return {k: v for k, v in q.items() if k not in ("_id",)}


# ----------------- Seed -----------------
async def seed_admin():
    existing = await db.admins.find_one({"email": "admin@test.com"}, {"_id": 0})
    if not existing:
        pwd_hash = bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode()
        await db.admins.insert_one({
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": "admin@test.com",
            "passwordHash": pwd_hash,
            "createdAt": now_iso(),
        })
        log.info("Seeded admin: admin@test.com / admin123")


async def seed_questions():
    count = await db.questions.count_documents({})
    if count > 0:
        return
    docs = []
    for section_key, items in QUESTIONS_POOL.items():
        for idx, item in enumerate(items):
            docs.append({
                "id": str(uuid.uuid4()),
                "sectionType": section_key,
                "difficulty": "medium",
                "isActive": True,
                "orderIndex": idx,
                "data": item,
                "createdAt": now_iso(),
            })
    if docs:
        await db.questions.insert_many(docs)
        log.info(f"Seeded {len(docs)} questions")


async def seed_settings():
    for s in SECTIONS:
        existing = await db.settings.find_one({"sectionType": s["key"]}, {"_id": 0})
        if not existing:
            await db.settings.insert_one({
                "id": str(uuid.uuid4()),
                "sectionType": s["key"],
                "isEnabled": True,
                "timerSeconds": s["timer"],
                "questionsPerSession": s["per_session"],
            })


@app.on_event("startup")
async def on_startup():
    await seed_admin()
    await seed_questions()
    await seed_settings()


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ----------------- Public meta -----------------
@api.get("/meta/sections")
async def get_sections_meta():
    settings = await db.settings.find({}, {"_id": 0}).to_list(100)
    settings_by_key = {s["sectionType"]: s for s in settings}
    out = []
    for s in SECTIONS:
        cfg = settings_by_key.get(s["key"], {})
        out.append({
            **s,
            "isEnabled": cfg.get("isEnabled", True),
            "timerSeconds": cfg.get("timerSeconds", s["timer"]),
            "questionsPerSession": cfg.get("questionsPerSession", s["per_session"]),
        })
    return out


# ----------------- Candidate test flow -----------------
@api.post("/test/start")
async def start_test(payload: CandidateStart):

    cand = await db.candidates.find_one(
        {"email": payload.email},
        {"_id": 0}
    )

    # ------------------------------------------------
    # Patch old candidates missing auth fields
    # ------------------------------------------------
    if cand and "testToken" not in cand:

        token = str(uuid.uuid4())

        await db.candidates.update_one(
            {"id": cand["id"]},
            {
                "$set": {
                    "testToken": token,
                    "tokenExpiresAt": now_iso(),
                    "isUsed": False,
                }
            }
        )

        cand["testToken"] = token
        cand["isUsed"] = False

    # ------------------------------------------------
    # Create new candidate
    # ------------------------------------------------
    if not cand:

        cand = {
            "id": str(uuid.uuid4()),
            "name": payload.name,
            "email": payload.email,

            "testToken": str(uuid.uuid4()),
            "tokenExpiresAt": now_iso(),
            "isUsed": False,

            "createdAt": now_iso(),
        }

        await db.candidates.insert_one({**cand})

    existing_session = await db.sessions.find_one(
        {
            "candidateId": cand["id"],
            "status": "in_progress"
        },
        {"_id": 0}
    )

    if existing_session:

        return {
            "sessionId": existing_session["id"],
            "candidateId": cand["id"],
            "testToken": cand["testToken"],
            "questionOrder": existing_session["questionOrder"],
            "sections": await build_sections_payload(
                existing_session["questionOrder"]
            ),
        }
    settings = await db.settings.find({}, {"_id": 0}).to_list(100)
    settings_by_key = {s["sectionType"]: s for s in settings}

    questions_all = await db.questions.find({"isActive": True}, {"_id": 0}).to_list(2000)
    by_section: Dict[str, list] = {}
    for q in questions_all:
        by_section.setdefault(q["sectionType"], []).append(q)

    question_order: List[Dict[str, Any]] = []
    sections_payload: List[Dict[str, Any]] = []

    for s in SECTIONS:
        cfg = settings_by_key.get(s["key"])
        if cfg and not cfg.get("isEnabled", True):
            continue
        per = cfg["questionsPerSession"] if cfg else s["per_session"]
        timer = cfg["timerSeconds"] if cfg else s["timer"]
        pool = by_section.get(s["key"], [])

        if s["key"] == "sentence_building":
            jumbles = [q for q in pool if q["data"].get("buildType") == "jumble"]
            topics = [q for q in pool if q["data"].get("buildType") == "topic"]
            half = max(1, per // 2)
            picked = fy_shuffle(pick_random(jumbles, half) + pick_random(topics, per - half))
        elif s["key"] == "interview":
            picked = pool[:1]
        else:
            picked = pick_random(pool, per)

        for q in picked:
            question_order.append({"sectionType": s["key"], "questionId": q["id"]})
            sections_payload.append({
                "sectionType": s["key"],
                "sectionName": s["name"],
                "sectionNum": s["num"],
                "sectionDesc": s["desc"],
                "uiType": s["type"],
                "timerSeconds": timer,
                "questionId": q["id"],
                "data": q["data"],
            })

    session = {
        "id": str(uuid.uuid4()),
        "candidateId": cand["id"],
        "candidateName": cand["name"],
        "candidateEmail": cand["email"],
        "questionOrder": question_order,
        "status": "in_progress",
        "startedAt": now_iso(),
        "completedAt": None,
        "overallScore": None,
        "aiFeedback": None,
        "sectionScores": None,
        "hrNotes": "",
        "hrStatus": "pending",
        "hrReviewedAt": None,
    }
    await db.sessions.insert_one({**session})
    return {
        "sessionId": session["id"],
        "candidateId": cand["id"],
        "testToken": cand["testToken"],
        "questionOrder": question_order,
        "sections": sections_payload,
    }

@api.get("/test/verify-token/{token}")
async def verify_token(token: str):

    candidate = await db.candidates.find_one(
        {
            "testToken": token
        },
        {"_id": 0}
    )

    if not candidate:
        raise HTTPException(
            status_code=404,
            detail="Invalid test link"
        )

    if candidate.get("isUsed"):
        raise HTTPException(
            status_code=403,
            detail="Test already completed"
        )

    return {
        "valid": True,
        "candidate": {
            "name": candidate.get("name"),
            "email": candidate.get("email"),
        }
    }


async def build_sections_payload(question_order: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    settings = await db.settings.find({}, {"_id": 0}).to_list(100)
    settings_by_key = {s["sectionType"]: s for s in settings}
    section_meta = {s["key"]: s for s in SECTIONS}
    out = []
    for item in question_order:
        q = await db.questions.find_one({"id": item["questionId"]}, {"_id": 0})
        if not q:
            continue
        cfg = settings_by_key.get(item["sectionType"], {})
        meta = section_meta.get(item["sectionType"], {})
        out.append({
            "sectionType": item["sectionType"],
            "sectionName": meta.get("name"),
            "sectionNum": meta.get("num"),
            "sectionDesc": meta.get("desc"),
            "uiType": meta.get("type"),
            "timerSeconds": cfg.get("timerSeconds", meta.get("timer", 60)),
            "questionId": q["id"],
            "data": q["data"],
        })
    return out


@api.post("/test/response")
async def save_response(payload: ResponseSave):
    doc = payload.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["recordedAt"] = now_iso()
    doc["aiScore"] = None
    doc["aiComment"] = None
    doc["hrScore"] = None
    doc["hrComment"] = None
    await db.responses.update_one(
        {"sessionId": payload.sessionId, "questionId": payload.questionId},
        {"$set": doc},
        upsert=True,
    )
    return {"ok": True, "id": doc["id"]}


@api.post("/test/conversation")
async def conversation_turn(payload: ConversationTurn):
    """Multi-turn conversation with Claude for S8/S13/S15."""
    system_msg = (
        f"You are a {payload.role} in this scenario: {payload.context}. "
        f"Stay in character throughout. Keep responses to 2-3 sentences max. "
        f"Always ask a relevant follow-up question to keep the conversation going. "
        f"Do not break character or give meta commentary."
    )
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"{payload.sessionId}-{payload.scenarioId}",
        system_message=system_msg,
    ).with_model("anthropic", CLAUDE_MODEL)
    try:
        history_str = ""
        for h in payload.history:
            who = "AI" if h.get("role") == "ai" else "Candidate"
            history_str += f"\n{who}: {h.get('message','')}"
        prompt = (
            f"Previous conversation:{history_str}\n\nCandidate: {payload.candidateMessage}\n\n"
            f"Respond in character with 2-3 sentences and end with a follow-up question."
            if history_str else
            f"Candidate: {payload.candidateMessage}\n\nRespond in character with 2-3 sentences and end with a follow-up question."
        )
        reply = await chat.send_message(UserMessage(text=prompt))
    except Exception:
        log.exception("Claude conversation failed")
        reply = "Thanks for sharing. Could you elaborate a bit further on that point?"

    await db.conversation_logs.update_one(
        {"sessionId": payload.sessionId, "scenarioId": payload.scenarioId},
        {"$set": {
            "id": str(uuid.uuid4()),
            "sessionId": payload.sessionId,
            "scenarioId": payload.scenarioId,
            "sectionType": payload.sectionType,
            "questionId": payload.questionId,
            "lastUpdated": now_iso(),
        },
         "$push": {"conversationHistory": {"$each": [
             {"role": "candidate", "message": payload.candidateMessage, "ts": now_iso()},
             {"role": "ai", "message": str(reply), "ts": now_iso()},
         ]}}},
        upsert=True,
    )
    return {"reply": str(reply)}


# Updated `/test/complete` Function

@api.post("/test/complete")
async def complete_test(payload: CompleteRequest):

    session = await db.sessions.find_one(
        {"id": payload.sessionId},
        {"_id": 0}
    )

    if not session:
        raise HTTPException(404, "Session not found")

    responses = await db.responses.find(
        {"sessionId": payload.sessionId},
        {"_id": 0}
    ).to_list(500)

    convos = await db.conversation_logs.find(
        {"sessionId": payload.sessionId},
        {"_id": 0}
    ).to_list(50)

    section_meta = {s["key"]: s for s in SECTIONS}

    # ---------------------------------------------------
    # ENRICH RESPONSES WITH QUESTION + SECTION DETAILS
    # ---------------------------------------------------
    for r in responses:

        q = await db.questions.find_one(
            {"id": r["questionId"]},
            {"_id": 0}
        )

        qdata = q.get("data", {}) if q else {}

        normalized_question = (
            qdata.get("sentence")
            or qdata.get("prompt")
            or qdata.get("question")
            or qdata.get("text")
            or qdata.get("topic")
            or qdata.get("passage")
            or qdata.get("imagePrompt")
            or qdata.get("storyText")
            or "Question"
        )

        r["question"] = {
            **qdata,
            "displayText": normalized_question
        }

        r["sectionName"] = section_meta.get(
            r.get("sectionType"),
            {}
        ).get("name", r.get("sectionType", "Unknown"))

    # ---------------------------------------------------
    # BUILD EVALUATION ITEMS
    # ---------------------------------------------------
    eval_items = []

    for r in responses:

        eval_items.append({
            "questionId": r.get("questionId"),
            "sectionType": r.get("sectionType"),
            "questionData": r.get("question", {}),

            "transcript": (
                r.get("transcript")
                or r.get("typedText")
                or r.get("selectedOption")
                or ""
            ),

            "selectedOption": r.get("selectedOption"),
            "typedText": r.get("typedText"),

            "wpm": r.get("wpm"),
            "accuracyPercentage": r.get("accuracyPercentage"),
            "extra": r.get("extra"),

        })

    # ---------------------------------------------------
    # BUILD CONVERSATION ITEMS
    # ---------------------------------------------------
    convo_items = []

    for c in convos:

        convo_items.append({
            "scenarioId": c.get("scenarioId"),
            "questionId": c.get("questionId"),
            "sectionType": c.get("sectionType"),
            "history": c.get("conversationHistory", []),
        })

    # ---------------------------------------------------
    # FILTER ANSWERED / UNANSWERED
    # ---------------------------------------------------
    def has_answer(item):

        transcript = str(item.get("transcript", "")).strip()
        typed = str(item.get("typedText", "")).strip()
        selected = str(item.get("selectedOption", "")).strip()

        extra = item.get("extra")
        has_extra = extra is not None and extra != {}

        return bool(
            transcript or
            typed or
            selected or
            has_extra
        )      
            

    """answered_items = eval_items

    unanswered_items = [
        item for item in eval_items
        if not has_answer(item)
    ]"""

    system_msg = (
    "You are an English proficiency evaluator. "
    "Return ONLY valid JSON."
)
        
    all_scores = []
    BATCH_SIZE = 3
    answered_items = eval_items

    for i in range(0, len(answered_items), BATCH_SIZE):

        batch = answered_items[i:i + BATCH_SIZE]    
        auto_scored = []
        real_batch = []

        # -----------------------------------------
        # Separate skipped vs answered
        # -----------------------------------------
        for item in batch:

            if not has_answer(item):

                auto_scored.append({
                    "questionId": item["questionId"],
                    "score": 0,

                    "strengths": [],

                    "weaknesses": [
                        "Question was skipped."
                    ],

                    "improvements": [
                        "Attempt the question to receive evaluation."
                    ],

                    "comment": "Question was skipped."
                })

            else:
                real_batch.append({
                    "questionId": item.get("questionId"),
                    "sectionType": item.get("sectionType"),
                    "transcript": item.get("transcript", "")[:500],
                    "typedText": item.get("typedText", "")[:500],
                    "selectedOption": item.get("selectedOption"),
                })
        # Add skipped immediately
        all_scores.extend(auto_scored)

        # If entire batch skipped → continue
        if not real_batch:
            continue

        try:
            batch_prompt = f"""
            Evaluate these English proficiency responses. Give comprehensive, detailed feedback.

         RESPONSES:
            {json.dumps(real_batch[:5], ensure_ascii=False)}


            For each response, evaluate strictly based on the section type criteria.
            Score 0-20. Be detailed and specific in feedback.

            Return ONLY a valid JSON array. No markdown. No explanation.

            Format:
            [
            {{
                "questionId": "exact-question-id-from-input",
                "score": 15,
                "strengths": [
                "Specific strength 1 with detail",
                "Specific strength 2 with detail"
                ],
                "weaknesses": [
                "Specific area to improve with detail"
                ],
                "improvements": [
                "Specific actionable suggestion"
                ],
                "comment": "2-3 sentence comprehensive evaluation covering accuracy, fluency, vocabulary, grammar and communication clarity."
            }}
            ]

            IMPORTANT: 
            - The questionId in your response MUST exactly match the questionId from the input
            - Every question in the input MUST have a corresponding entry in your output
            - Be specific and detailed, not generic
            """
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"score-{payload.sessionId}-{i}",
                system_message=system_msg,
            ).with_model("anthropic", CLAUDE_MODEL)

            try:

                raw = await asyncio.wait_for(
                    chat.send_message(
                        UserMessage(text=batch_prompt)
                    ),
                    timeout=20
                )

            except asyncio.TimeoutError:

                print("CLAUDE TIMEOUT")

                raw = "[]"

            text = str(raw).strip()

            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)

            print("RAW MODEL OUTPUT:")
            print(text)

            # ---------------------------------
            # SAFE JSON PARSING
            # ---------------------------------

            parsed = None

            # try direct parse first
            try:

                parsed = json.loads(text)

            except Exception:

                # try array extraction
                array_match = re.search(r"\[.*\]", text, re.DOTALL)

                # try object extraction
                object_match = re.search(r"\{.*\}", text, re.DOTALL)

                if array_match:

                    parsed = json.loads(array_match.group(0))

                elif object_match:

                    parsed = [json.loads(object_match.group(0))]

                else:

                    raise Exception(
                        f"Could not parse model output:\n{text}"
                    )

            # normalize object -> list
            if isinstance(parsed, dict):

                parsed = [parsed]

            print("PARSED JSON:")
            print(parsed)

            # ADD SCORES TO FINAL ARRAY
            for item in parsed:

                all_scores.append({
                    "questionId": item.get("questionId"),
                    "score": int(item.get("score", 0)),

                    "strengths": item.get("strengths", []),

                    "weaknesses": item.get("weaknesses", []),

                    "improvements": item.get("improvements", []),

                    "comment": item.get(
                        "comment",
                        "No feedback available."
                    )
                })

            


        except Exception as e:

            print("MODEL ERROR:", str(e))
            logger.exception("Batch evaluation failed")

            for item in real_batch:

                    all_scores.append({
                        "questionId": item["questionId"],
                        "score": 0,

                        "strengths": [],

                        "weaknesses": [
                            "AI evaluation failed."
                        ],

                        "improvements": [
                            "Retry evaluation."
                        ],

                        "comment": "Could not evaluate response."
                    })
    # ---------------------------------------------------
    # SECTION SCORES
    # ---------------------------------------------------
    section_score_map = {}

    qid_to_section = {
        r["questionId"]: r["sectionType"]
        for r in responses
    }

    for s in all_scores:

        section = qid_to_section.get(
            s["questionId"],
            ""
        )

        if section:

            section_score_map.setdefault(
                section,
                []
            ).append(s["score"])

    computed_section_scores = {}

    for section_key, vals in section_score_map.items():

        computed_section_scores[section_key] = round(
            sum(vals) / len(vals) * 5
        )

    overall = round(
        sum(computed_section_scores.values()) /
        max(1, len(computed_section_scores))
    )

    # ---------------------------------------------------
    # OVERALL FEEDBACK
    # ---------------------------------------------------
    try:

        feedback_prompt = f"""
You are an expert English communication evaluator.

Analyze the candidate's overall English proficiency using:
- fluency
- grammar
- vocabulary
- communication clarity
- professionalism
- confidence
- workplace readiness

SECTION SCORES:
{json.dumps(computed_section_scores)}

RESPONSES:
{json.dumps(eval_items[:5], ensure_ascii=False)}

QUESTION FEEDBACK:
{json.dumps(all_scores[:5], ensure_ascii=False)}

Write a professional 5-7 sentence evaluation summary.
Return ONLY the summary text.
"""

        chat_fb = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"feedback-{payload.sessionId}",
            system_message="You are an English proficiency evaluator.",
        ).with_model("anthropic", CLAUDE_MODEL)

        overall_feedback = str(
            await chat_fb.send_message(
                UserMessage(text=feedback_prompt)
            )
        ).strip()

    except Exception:

        logger.exception("Overall feedback generation failed")

        overall_feedback = (
            f"Candidate completed the English proficiency test "
            f"with an overall score of {overall}/100."
        )

    # ---------------------------------------------------
    # MERGE SCORES + RESPONSES
    # ---------------------------------------------------
    response_map = {
        r["questionId"]: r
        for r in responses
    }

    merged_scores = []

    for score in all_scores:

        response = response_map.get(
            score.get("questionId"),
            {}
        )

        merged_scores.append({

            "questionId": (
                response.get("questionId")
                or score.get("questionId")
            ),

            "sectionType": response.get(
                "sectionType",
                "unknown"
            ),

            "sectionName": response.get(
                "sectionName",
                "Unknown"
            ),

            "question": response.get(
                "question",
                {}
            ),

            "score": score.get("score", 0),

            "comment": score.get(
                "comment",
                "No feedback available."
            ),
             "strengths": score.get(
                "strengths",
                []
            ),

            "weaknesses": score.get(
                "weaknesses",
                []
            ),

            "improvements": score.get(
                "improvements",
                []
            ),

            "transcript": response.get(
                "transcript",
                ""
            ),

            "typedText": response.get(
                "typedText",
                ""
            ),

            "selectedOption": response.get(
                "selectedOption",
                ""
            ),

            "wpm": response.get("wpm"),

            "accuracyPercentage": response.get(
                "accuracyPercentage"
            ),
        })

    # ---------------------------------------------------
    # SAVE SCORES TO RESPONSES
    # ---------------------------------------------------
    score_map = {
        s["questionId"]: s
        for s in merged_scores
    }

    for r in responses:

        s = score_map.get(r["questionId"])

        if s:

            await db.responses.update_one(
                {
                    "sessionId": payload.sessionId,
                    "questionId": r["questionId"]
                },
                {
                    "$set": {
                       "aiScore": s.get("score"),
                        "aiComment": s.get("comment"),
                        "aiStrengths": s.get("strengths", []),
                        "aiWeaknesses": s.get("weaknesses", []),
                        "aiImprovements": s.get("improvements", []),
                         }
                },
            )
    await db.candidates.update_one(
     {
    "email": session.get("candidateEmail")
        },
                {
                    "$set": {
                        "isUsed": True
                    }   
                }
            )

    # ---------------------------------------------------
    # UPDATE SESSION
    # ---------------------------------------------------
    await db.sessions.update_one(
        {"id": payload.sessionId},
        {
            "$set": {
                "status": "completed",
                "completedAt": now_iso(),
                "overallScore": overall,
                "aiFeedback": overall_feedback,
                "sectionScores": computed_section_scores,
            }
        },
    )
    print("RETURNING FINAL RESPONSE")
    return {
        "sessionId": payload.sessionId,
        "overallScore": overall,
        "sectionScores": computed_section_scores,
        "overallFeedback": overall_feedback,

        # frontend feedback rendering
        "scores": merged_scores,

        # frontend accordion mapping
        "responses": responses
    }


# ----------------- Admin auth -----------------
@api.post("/admin/login")
async def admin_login(payload: AdminLogin):
    user = await db.admins.find_one({"email": payload.email}, {"_id": 0})
    if not user:
        raise HTTPException(401, "Invalid credentials")
    if not bcrypt.checkpw(payload.password.encode(), user["passwordHash"].encode()):
        raise HTTPException(401, "Invalid credentials")
    token = make_token({"sub": user["id"], "email": user["email"], "role": "admin"})
    return {"token": token, "name": user["name"], "email": user["email"]}


# ----------------- Admin: Dashboard -----------------
@api.get("/admin/dashboard")
async def admin_dashboard(_: Any = Depends(admin_required)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    total_candidates = await db.candidates.count_documents({})
    tests_today = await db.sessions.count_documents({"startedAt": {"$gte": today_start}})
    pending_hr = await db.sessions.count_documents({"hrStatus": "pending", "status": "completed"})

    completed = await db.sessions.find({"status": "completed"}, {"_id": 0, "overallScore": 1, "sectionScores": 1}).to_list(2000)
    avg_overall = round(sum((s.get("overallScore") or 0) for s in completed) / max(1, len(completed)), 1) if completed else 0

    section_totals: Dict[str, list] = {}
    for s in completed:
        ss = s.get("sectionScores") or {}
        for k, v in ss.items():
            section_totals.setdefault(k, []).append(v)
    avg_by_section = []
    for s in SECTIONS:
        scores = section_totals.get(s["key"], [])
        avg_by_section.append({
            "sectionType": s["key"],
            "sectionName": s["name"],
            "avgScore": round(sum(scores) / max(1, len(scores)), 1) if scores else 0,
        })

    recent = await db.sessions.find({}, {"_id": 0}).sort("startedAt", -1).to_list(10)
    recent_clean = [{
        "id": s["id"],
        "candidateName": s.get("candidateName", ""),
        "candidateEmail": s.get("candidateEmail", ""),
        "startedAt": s.get("startedAt"),
        "overallScore": s.get("overallScore"),
        "status": s.get("status"),
        "hrStatus": s.get("hrStatus", "pending"),
    } for s in recent]

    return {
        "totalCandidates": total_candidates,
        "testsToday": tests_today,
        "avgScore": avg_overall,
        "pendingHrReviews": pending_hr,
        "avgBySection": avg_by_section,
        "recentCandidates": recent_clean,
    }


# ----------------- Admin: Questions -----------------
@api.get("/admin/questions")
async def list_questions(sectionType: Optional[str] = None, _: Any = Depends(admin_required)):
    query: Dict[str, Any] = {}
    if sectionType:
        query["sectionType"] = sectionType
    qs = await db.questions.find(query, {"_id": 0}).sort("orderIndex", 1).to_list(2000)
    return qs


@api.post("/admin/questions")
async def create_question(payload: QuestionUpsert, _: Any = Depends(admin_required)):
    doc = {
        "id": str(uuid.uuid4()),
        "sectionType": payload.sectionType,
        "difficulty": payload.difficulty or "medium",
        "isActive": payload.isActive,
        "orderIndex": payload.orderIndex or 0,
        "data": payload.data,
        "createdAt": now_iso(),
    }
    await db.questions.insert_one({**doc})
    return doc


@api.put("/admin/questions/{qid}")
async def update_question(qid: str, payload: QuestionUpsert, _: Any = Depends(admin_required)):
    update = {
        "sectionType": payload.sectionType,
        "difficulty": payload.difficulty or "medium",
        "isActive": payload.isActive,
        "orderIndex": payload.orderIndex or 0,
        "data": payload.data,
    }
    res = await db.questions.update_one({"id": qid}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Not found")
    q = await db.questions.find_one({"id": qid}, {"_id": 0})
    return q


@api.delete("/admin/questions/{qid}")
async def delete_question(qid: str, _: Any = Depends(admin_required)):
    await db.questions.delete_one({"id": qid})
    return {"ok": True}


# ----------------- Admin: Candidates -----------------
@api.get("/admin/candidates")
async def list_candidates(_: Any = Depends(admin_required)):
    sessions = await db.sessions.find({}, {"_id": 0}).sort("startedAt", -1).to_list(2000)
    return [{
        "id": s["id"],
        "candidateId": s.get("candidateId"),
        "candidateName": s.get("candidateName"),
        "candidateEmail": s.get("candidateEmail"),
        "startedAt": s.get("startedAt"),
        "completedAt": s.get("completedAt"),
        "status": s.get("status"),
        "overallScore": s.get("overallScore"),
        "hrStatus": s.get("hrStatus", "pending"),
    } for s in sessions]


@api.get("/admin/candidates/{sessionId}")
async def candidate_detail(sessionId: str, _: Any = Depends(admin_required)):
    session = await db.sessions.find_one({"id": sessionId}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Not found")
    responses = await db.responses.find({"sessionId": sessionId}, {"_id": 0}).to_list(500)
    convos = await db.conversation_logs.find({"sessionId": sessionId}, {"_id": 0}).to_list(50)
    for r in responses:
        q = await db.questions.find_one({"id": r["questionId"]}, {"_id": 0})
        r["question"] = q.get("data") if q else {}
    section_meta = {s["key"]: s for s in SECTIONS}
    return {
        "session": session,
        "responses": responses,
        "conversations": convos,
        "sectionMeta": section_meta,
    }


@api.put("/admin/hr-review/{sessionId}")
async def save_hr_review(sessionId: str, payload: HrReviewSave, _: Any = Depends(admin_required)):
    session = await db.sessions.find_one({"id": sessionId}, {"_id": 0})
    if not session:
        raise HTTPException(404, "Not found")
    for item in payload.perResponse:
        await db.responses.update_one(
            {"sessionId": sessionId, "questionId": item.get("questionId")},
            {"$set": {"hrScore": item.get("hrScore"), "hrComment": item.get("hrComment", "")}},
        )
    await db.sessions.update_one(
        {"id": sessionId},
        {"$set": {"hrNotes": payload.hrNotes, "hrStatus": "reviewed", "hrReviewedAt": now_iso()}},
    )
    return {"ok": True}


# ----------------- Admin: Settings -----------------
@api.get("/admin/settings")
async def get_settings(_: Any = Depends(admin_required)):
    items = await db.settings.find({}, {"_id": 0}).to_list(100)
    by_key = {x["sectionType"]: x for x in items}
    out = []
    for s in SECTIONS:
        cfg = by_key.get(s["key"], {})
        out.append({
            "sectionType": s["key"],
            "sectionName": s["name"],
            "sectionNum": s["num"],
            "isEnabled": cfg.get("isEnabled", True),
            "timerSeconds": cfg.get("timerSeconds", s["timer"]),
            "questionsPerSession": cfg.get("questionsPerSession", s["per_session"]),
            "defaultTimer": s["timer"],
            "defaultPerSession": s["per_session"],
        })
    return out


@api.put("/admin/settings")
async def update_settings(payloads: List[SettingsUpsert], _: Any = Depends(admin_required)):
    for p in payloads:
        await db.settings.update_one(
            {"sectionType": p.sectionType},
            {"$set": {
                "isEnabled": p.isEnabled,
                "timerSeconds": p.timerSeconds,
                "questionsPerSession": p.questionsPerSession,
            }},
            upsert=True,
        )
    return {"ok": True}


@api.post("/admin/settings/reset")
async def reset_settings(_: Any = Depends(admin_required)):
    for s in SECTIONS:
        await db.settings.update_one(
            {"sectionType": s["key"]},
            {"$set": {
                "isEnabled": True,
                "timerSeconds": s["timer"],
                "questionsPerSession": s["per_session"],
            }},
            upsert=True,
        )
    return {"ok": True}


# ----------------- Health -----------------
@api.get("/")
async def root():
    return {"app": "HireFast", "ok": True}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)