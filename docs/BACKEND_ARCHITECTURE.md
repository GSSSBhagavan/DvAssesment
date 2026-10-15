# BACKEND ARCHITECTURE & MIGRATION DESIGN: DataValley Assessment Platform

## 1. Current Repository Audit

Based on a direct inspection of the codebase, the application currently operates entirely as a frontend monolith using Next.js (React 19) and Zustand.

**Verified Current State:**
*   **Frontend UI & Workspaces:** Fully implemented, including diverse question type renderers (MCQ, Git, Email, etc.).
*   **Assessment State:** Managed exclusively client-side via Zustand (`src/hooks/useAssessmentState.ts`) with `localStorage` persistence. The timer and deadline logic depend on the browser clock.
*   **Data Security:** Stage 1 successfully isolated evaluation keys into `src/server/assessment-keys.ts` (marked with `import 'server-only'`) and safe candidate questions into `src/lib/safe-questions.ts`.
*   **Proctoring (Integrity):** Currently relies on basic browser DOM events (visibility API, fullscreen API).
*   **Backend & APIs:** **Non-existent.** There are no API endpoints in `src/app/api`, no server-side mutations, and no implemented database models.
*   **Database Config:** A functional MongoDB connection utility exists at `src/config/database.ts` using Mongoose.
*   **Authentication:** Missing. Currently, candidates enter the flow directly from the landing page.

## 2. Recommended Architecture & Justification

**Recommendation: Option A - Next.js App Router with Route Handlers and modular server-side services.**

**Justification:**
1.  **Codebase Continuity:** The project is already a robust Next.js App Router application. Injecting `src/app/api` preserves the monolithic convenience while adding secure backend capabilities.
2.  **Shared Typing:** Types, constants, and Zod schemas can be shared effortlessly between the frontend and backend without requiring a monorepo workspace setup.
3.  **Connection Management:** The existing `src/config/database.ts` employs a global connection cache, correctly mitigating serverless cold-start exhaustion typical in Next.js APIs.
4.  **Concurrency Model:** 100 simultaneous candidates saving their answers triggers ~6 requests/second. Next.js serverless functions (or a standard Next Node process) can effortlessly absorb this traffic without a separate Express server orchestration.
5.  **Simplicity:** Adding an external Express/Node backend would mandate complex CORS handling and duplicate authentication middleware.

## 3. Complete Proposed Folder Tree

```text
assessment-platform/
├── docs/
│   └── BACKEND_ARCHITECTURE.md
├── src/
│   ├── app/
│   │   ├── api/                      # NEW: Backend API Layer
│   │   │   ├── auth/
│   │   │   │   └── route.ts
│   │   │   ├── assessment/
│   │   │   │   ├── start/route.ts
│   │   │   │   ├── sync/route.ts
│   │   │   │   └── submit/route.ts
│   │   │   └── integrity/
│   │   │       └── event/route.ts
│   │   ├── assessment/               # Existing frontend
│   │   ├── results/                  # Existing frontend
│   │   └── page.tsx                  # Existing frontend
│   ├── components/                   # Existing UI
│   ├── config/
│   │   └── database.ts               # Existing DB config
│   ├── hooks/
│   │   └── useAssessmentState.ts     # TO BE MODIFIED: Will sync with APIs
│   ├── lib/
│   │   └── safe-questions.ts         # Existing safe payload
│   └── server/                       # NEW: Core Server Layer
│       ├── assessment-keys.ts        # Existing evaluation keys
│       ├── models/                   # NEW: Mongoose Schemas
│       │   ├── Candidate.ts
│       │   ├── AssessmentSession.ts
│       │   └── ProctoringEvent.ts
│       ├── services/                 # NEW: Business Logic
│       │   ├── session.service.ts
│       │   ├── evaluation.service.ts
│       │   └── integrity.service.ts
│       ├── validation/               # NEW: Zod Schemas
│       │   └── api.schema.ts
│       └── utils/                    # NEW: Auth & Error wrappers
│           ├── errors.ts
│           └── auth.ts
```

## 4. Responsibility of Important Directories & Files

*   **`src/app/api/`:** Only handles HTTP protocols: extracting request payloads, invoking `server/services`, and formatting JSON responses. Contains no core business logic.
*   **`src/server/models/`:** Defines MongoDB schemas, collections, indexes, and type interfaces for Mongoose.
*   **`src/server/services/`:** Contains isolated, unit-testable business rules (e.g., scoring logic, Git regex evaluation, deadline validation).
*   **`src/server/validation/`:** Uses Zod schemas to validate all incoming HTTP payloads (answers, proctoring events) to prevent NoSQL injection and malformed data.
*   **`src/server/utils/auth.ts`:** Verifies JWTs or access tokens on protected API routes.

## 5. Existing-File-to-New-Architecture Mapping

| Existing File | Required Architectural Change |
| :--- | :--- |
| `src/hooks/useAssessmentState.ts` | Remove mock `setTimeout` submissions. Hook must implement debounced `fetch` to `PUT /api/assessment/sync`. |
| `src/app/page.tsx` | Needs integration with Authentication. Instead of immediately routing to `/assessment`, it must request an access token or validate one. |
| `src/components/integrity/AntiCheatMonitor.tsx` | Needs to flush accumulated local integrity events to `POST /api/integrity/event` on a heartbeat. |
| `src/app/results/page.tsx` | Should stop relying purely on Zustand. It must fetch authoritative final scores from the backend via server component data fetching. |

## 6. Domain Model Relationships

**Candidate**
*   **Fields:** `_id`, `email`, `fullName`, `role`
*   **Responsibility:** Represents the physical user.

**AssessmentSession**
*   **Fields:** `_id`, `candidateId` (Ref), `status` (STARTED, SUBMITTED, EXPIRED), `startTime`, `expiresAt`, `answers` (Embedded Array), `score`
*   **Relationship:** 1:1 with Candidate per assessment.
*   **Design Choice:** **Answers are embedded inside the session document.** Given the strict 60-question limit, embedding `[{ questionId: number, value: string, timestamp: Date }]` prevents write-contention, eliminates multi-document transactions during the 60-minute burst, and makes fetching the session an O(1) operation.

**ProctoringEvent**
*   **Fields:** `_id`, `sessionId` (Ref), `eventType` (TAB_SWITCH, FACE_LOST), `timestamp`, `severity`
*   **Relationship:** N:1 with AssessmentSession.
*   **Design Choice:** Stored in a separate collection. Proctoring logs can grow unpredictably (e.g., rapid face loss toggling). Embedding them in the session would risk breaching the 16MB MongoDB document limit and bloat query sizes.

## 7. API Contract Table

| Endpoint | Method | Auth | Request Payload | Response / Action |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth` | POST | None | `{ token: string }` | Returns Session Cookie / JWT |
| `/api/assessment/start` | POST | Required | None | Creates DB Session, returns server-authoritative `expiresAt` |
| `/api/assessment/sync` | PUT | Required | `{ answers: [{ id, val }] }`| Idempotent upsert of answers. Updates `updatedAt`. |
| `/api/assessment/submit` | POST | Required | None | Finalizes session. Triggers `evaluation.service.ts`. |
| `/api/integrity/event` | POST | Required | `{ events: [...] }` | Appends events to `ProctoringEvent` collection. |
| `/api/assessment/result` | GET | Required | None | Returns calculated score (if allowed to view). |

## 8. Authentication & Authorization Assumptions

Since no authentication currently exists, the architecture assumes a **Token-Based Magic Link or Access Code system**. 
1. HR generates a unique access code mapped to a candidate email.
2. Candidate enters the code on `/`.
3. `/api/auth` validates the code and issues a secure, HTTP-only JWT cookie.
4. Every route handler in `/api/assessment/*` runs an `auth.ts` middleware that extracts the candidate ID from the cookie.
5. Missing Auth: Without this, candidates could submit payloads on behalf of others.

## 9. Security Boundaries

*   **Server-Authoritative Clock:** The 60-minute timer in the UI is purely cosmetic. The backend locks the `expiresAt` timestamp upon `/api/assessment/start`. The `/api/assessment/submit` and `/sync` routes will strictly reject payloads sent after `expiresAt + grace_period`.
*   **Server-Side Scoring:** Answers are evaluated during `/submit` strictly against `src/server/assessment-keys.ts`. The client never calculates the final score.
*   **Untrusted Proctoring Events:** Browser-side AntiCheat monitors are treated as *untrusted signals*. A user disabling JS will stop sending events. The backend implements a "heartbeat" mechanism; if `sync` or `integrity` pings stop for >5 minutes, a `CONNECTION_LOST` high-risk flag is applied.

## 10. Error-Handling Strategy

*   **API Layer:** Wraps all Route Handlers in a higher-order function that catches exceptions.
*   **Validation Errors (Zod):** Caught and returned as `400 Bad Request` with field-level details.
*   **Database Errors:** Mongoose errors are intercepted. Connection timeouts return `503 Service Unavailable`.
*   **Frontend Recovery:** Zustand's fetch logic will detect `503` or network failures, queue the answers in `localStorage`, and exponentially retry until the network is restored.

## 11. Testing Strategy

*   **Unit Tests (Vitest):** Focused entirely on `src/server/services/evaluation.service.ts`. The Git command Regex engines must be rigorously tested against diverse string inputs (e.g., extra spaces, double quotes vs single quotes).
*   **Integration Tests:** API route tests verifying session expiry locks and database insertions using an in-memory MongoDB replica (e.g., `mongodb-memory-server`).

## 12. Performance & Load-Testing Plan

*   **Target Capacity:** 100 concurrent candidates.
*   **Database Indexing:** Index `candidateId` on `AssessmentSession`, and `sessionId` on `ProctoringEvent`.
*   **Network Debouncing:** The frontend will debounce `/sync` calls to fire only every 15 seconds, max.
*   **Load Test:** Use `k6`. Create a script simulating 100 users authenticating, sending a `/sync` payload every 15 seconds for 60 minutes, and triggering a simultaneous `/submit` at exactly the 3600-second mark to verify Mongoose connection pool stability.

## 13. Implementation Phases & Dependencies

1.  **Phase 1 (Data Layer):** Install Zod. Implement `Candidate`, `AssessmentSession`, `ProctoringEvent` models.
2.  **Phase 2 (Auth Layer):** Implement the access-code login and JWT cookie issuance.
3.  **Phase 3 (Session APIs):** Build `/start`, `/sync`, and integrate them into `useAssessmentState.ts`.
4.  **Phase 4 (Evaluation Engine):** Build `evaluation.service.ts` and the `/submit` endpoint.
5.  **Phase 5 (Integrity):** Build `/integrity/event` and wire up the frontend `AntiCheatMonitor`.

## 14. Risks, Blockers, & Unresolved Decisions

*   **Blocker:** The exact authentication flow (SSO vs Magic Link vs Manual Code) needs product approval before Phase 2 can begin.
*   **Risk:** Git Regex evaluation is inherently brittle. A candidate typing `git commit -m "fix"` vs `git commit -am "fix"` requires extremely robust regex definitions in the evaluation service to prevent unfair false negatives.
*   **Unresolved Decision:** Do candidates see their score immediately upon submission, or is it hidden pending HR review? The API contract for `/result` depends on this policy.
