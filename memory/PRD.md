# HireFast — Product Requirements Document

## Original Problem Statement
Build a complete full-stack English Proficiency Test app named "HireFast" with 21 test sections (voice/typing/MCQ/AI chat), Claude AI scoring, candidate light theme + admin dark theme, MongoDB persistence, and JWT-protected admin dashboard.

## Architecture
- **Backend**: FastAPI (Python) + Motor (async MongoDB) + emergentintegrations (Claude Sonnet 4.5)
- **Frontend**: React + Tailwind + shadcn/ui + framer-motion + recharts + jsPDF
- **AI**: Anthropic `claude-sonnet-4-5-20250929` via Emergent Universal LLM Key
- **Auth**: JWT (admin only); candidates are anonymous (name+email only)
- **Voice**: Browser Web Speech API (SpeechRecognition + SpeechSynthesis)

## User Personas
1. **Candidate** — completes 21-section English test (~25–35 min), gets AI-scored report.
2. **HR/Admin** — reviews candidates, manually rescores, manages question pool & section settings.

## Core Requirements (Static)
- 21 sections: Sentence Repetition, Reading Aloud, Vocabulary MCQ, Comprehension Q&A, Typing, Story Retelling, JAM, Situational Conversation (AI), Use Case, Sentence Building, Picture Description, Opinion, Role Play (AI), Pronunciation, Interview Simulation (AI 3 Q), Email Writing, Grammar Correction, Listening, Dictation, Word Association, Paraphrasing.
- Per-session Fisher-Yates shuffle within section.
- Circular countdown timer (purple → orange at 10s → red+pulse at 5s) on every question.
- Claude one-shot scoring: per-question 0-20, per-section 0-100, overall 0-100, paragraph feedback.

## Implemented (2026-02)
- ✅ Backend: 21-section seed (90 questions), settings, admin (admin@test.com / admin123)
- ✅ Candidate flow: `/api/test/start` → `/api/test/response` → `/api/test/conversation` → `/api/test/complete`
- ✅ Frontend Candidate: Welcome (form + 21 section preview), TestRunner (15 distinct section UIs), Complete (animated score + section breakdown + AI feedback)
- ✅ Frontend Admin: Login (JWT), Dashboard (4 stat cards + recharts bar chart + recent 10 candidates), Questions (21 tabs + CRUD modal), Candidates (list + detail with PDF export), HR Review (per-response scoring + notes), Settings (toggle + timer + per-session count)
- ✅ Multi-turn AI chat with typing indicator (Claude via emergentintegrations)
- ✅ Live transcript voice recorder, real-time typing test (WPM/Accuracy/Errors), TTS playback for repetition/story/dictation/listening
- ✅ Tested: 20/20 backend pytest cases passing including real Claude conversation + scoring

## P0 Backlog (Next)
- HR Review override should propagate to combined score in candidate detail
- "Resume test" UX banner if candidate refreshes mid-test (data already persists)

## P1 Backlog
- Email notification on test completion (SendGrid / Resend)
- Stripe paywall for org accounts (per-test pricing)
- CSV bulk-export of candidate results
- Multi-admin role management

## P2 Backlog
- Question difficulty auto-tagging via Claude
- Custom test templates per company
- Live cheating detection (tab switch, copy-paste alerts)

## Test Credentials
See `/app/memory/test_credentials.md`
