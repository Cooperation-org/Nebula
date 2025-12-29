# Cooperation Toolkit – Product Requirements Document (PRD)

## 1. Product Overview

### 1.1 Product Name (Working)

**Cooperation Toolkit**

### 1.2 Product Vision

Enable any team to share ownership and governance equitably through **earned contribution**, not capital ownership. The Cooperation Toolkit provides composable infrastructure for task tracking, peer review, attestation, and equity/governance updates, preserving team purpose and preventing capture.

### 1.3 Problem Statement

Traditional organizational structures:

- Concentrate power via capital rather than contribution
- Fail to fairly reward early or underfunded contributors
- Are vulnerable to mission drift, hostile takeover, or silent capture
- Provide little portable proof of real work for contributors

Existing tools fragment responsibility across task management, equity tracking, and governance, with no shared source of legitimacy.

### 1.4 Solution Summary

The Cooperation Toolkit provides a **contribution-to-governance pipeline**:

- Work is tracked via tasks
- Value is assigned and reviewed by peers
- Completed work issues verifiable attestations
- Attestations update earnings, equity, and governance weight
- Transparency is default; voting is exceptional

The system is backend-agnostic, mobile-friendly, and usable by both technical and non-technical teams.

---

## 2. Goals & Non-Goals

### 2.1 Goals (Production)

- Deliver a production-ready system for real teams sharing ownership and governance
- Enable earned equity and governance from day one, without transitional MVP constraints
- Support fairness for underfunded or early-stage teams at production quality
- Provide portable, verifiable proof of contribution suitable for long-term use
- Minimize governance overhead while maximizing trust and auditability
- Support multiple organizational forms (startup, coop, nonprofit) in production

### 2.2 Non-Goals

- Not a replacement for payroll systems
- Not a general-purpose project management suite
- Not a DAO or token-first governance platform
- Not fully autonomous AI decision-making

---

## 3. Target Users & Personas

### 3.1 Primary Users (Production)

**Early-stage tech startups / research collectives**

- Use Slack daily
- Comfortable with experimentation
- Ideologically aligned with fairness and transparency

### 3.2 Secondary Users (Post-MVP)

- Cooperatives
- Nonprofits
- Field teams (construction, logistics, agriculture)

### 3.3 Personas

**Contributor / Intern**

- Wants fair recognition and growth path
- Needs portable proof of work

**Founder / Steward**

- Wants to share ownership without losing mission control
- Needs anti-capture safeguards

**Reviewer / Peer**

- Ensures work quality and fairness
- Needs low-friction review tools

---

## 4. Core Principles (Product DNA)

- **Earned Governance**: Authority accrues through valuable work
- **Transparency over Permission**: Visibility replaces constant voting
- **Work-Weighted Influence**: Influence is proportional to earned contribution units (COOK)
- **Opportunity to Object**: Structured objection windows are built-in
- **Anti-Capture by Design**: Governance power cannot be purchased or transferred, only earned
- **Portability**: Contributors own their work history and attestations
- **Human-in-the-Loop AI**: AI assists, never governs

---

## 5. Core User Flows

### 5.1 Contribution Flow (COOK-based)

1. Task Created
2. **COOK Value Assigned** (provisional)
   - COOK represents standardized contribution units
   - Tasks may be self-cooked (self-assigned) or spend-cooked (assigned by others)

3. Work Performed
4. Peer Review
5. COOK Value Finalized
6. Task Completed
7. Attestation Issued
8. COOK Ledger Updated → Governance & Equity recalculated

### 5.2 Review Flow

- Reviewer notified
- Review checklist displayed
- Feedback + approval or objection
- Escalation if disputed

### 5.3 Governance Flow (When Triggered)

- Proposal created
- Objection window opens
- If unresolved → vote triggered
- Vote weighted by contribution

---

## 6. Functional Requirements

### 6.1 Task Management

- Create, edit, and archive tasks
- Assign contributors and reviewers
- Support **COOK-based task valuation**
- Distinguish between:
  - **Self-COOK**: contributor assigns task to self
  - **Spend-COOK**: contributor assigns task to others

- Track task state transitions
- Tasks are the **canonical system of record** regardless of interface

### 6.2 Project Boards & Views

- Support **Project Boards** as first-class views over tasks
- Two board modes are supported:
  - **External Boards (First-Class)**: GitHub Projects (preferred), Taiga
  - **Internal Boards (Native)**: lightweight built-in boards

- Boards are **views**, not separate task systems
- All boards must map to the same canonical task + COOK model

---

### 6.2.1 GitHub Mapping Specification (UX-Optimized)

**Design Principle:** Minimize friction by aligning with how teams already use GitHub, while enforcing governance implicitly through workflow.

#### Required GitHub Fields

- GitHub Issue (required)
- Project Item Status (required)
- Assignee(s) (required for COOK accrual)
- Linked Repository (if applicable)
- COOK (stored as structured metadata, not free text)
- Reviewer(s) (GitHub field or label-backed)

Optional (Recommended):

- COOK size class (S / M / L / XL)
- Task type (Build, Ops, Governance, Research)

---

#### Allowed Column Transitions (Default)

- Backlog → Ready
- Ready → In Progress
- In Progress → Review
- Review → Done

Guardrails:

- Skipping columns is disallowed by default
- High-COOK tasks may require multiple reviewers to enter Review
- Moving **into Review** automatically freezes provisional COOK

Teams may customize columns, but **must preserve a Review gate**.

---

#### Failure Modes & UX Handling

- **GitHub outage / API failure**:
  - Tasks become read-only
  - COOK issuance paused
  - Clear banner explaining system state

- **Desync between GitHub and Toolkit**:
  - Toolkit state is canonical
  - User prompted to reconcile differences

- **Unauthorized column movement**:
  - Movement allowed visually in GitHub
  - COOK issuance blocked
  - Reviewer or Steward notified

---

### 6.2.2 COOK Locking & Finalization Rules

**COOK States:**

- Draft (assigned but not started)
- Provisional (work in progress)
- Locked (awaiting review)
- Final (attested and issued)

Rules:

- COOK becomes **Provisional** when task enters In Progress
- COOK becomes **Locked** when task enters Review
- COOK becomes **Final** only after:
  - Required peer reviews approve
  - Objection window closes (if configured)

No COOK may be edited after Finalization.

---

### 6.2.3 Security Rules (UX-Aligned)

- **Who can move cards:**
  - Contributors may move tasks they are assigned to
  - Reviewers may move tasks into or out of Review
  - Stewards may override with audit logging

- **Who can issue COOK:**
  - COOK issuance is automatic upon Finalization
  - No individual may manually mint COOK
  - System actions are logged and attestable

---

### 6.2.4 Governance-by-Workflow (Vote Minimization)

Default governance happens through workflow, not voting:

- Task approval → implicit consent
- Review objections → pause, not conflict
- Committee selection → weighted lottery (no vote)

Voting is triggered **only if**:

- Objections exceed threshold
- Policy changes are proposed
- Constitutional rules are challenged

This ensures:

- Most governance is ambient and continuous
- Votes are rare, meaningful, and informed

---

### 6.2.5 Public & Private Board Visibility Rules

**Design Principle:** Default to transparency for legitimacy, while allowing privacy where exposure would cause harm or reduce participation.

#### Visibility Levels

- **Public (External Read-Only)**
  - Board is visible to anyone with the link
  - Task titles, states, and COOK totals are visible
  - Comments, reviewer identities, and deliberation notes are hidden
  - Intended for:
    - Public-facing projects
    - Community accountability
    - Demonstrating earned governance

- **Team-Visible (Default)**
  - All team members can view the board
  - Task details, reviewers, and COOK states are visible
  - Required for:
    - COOK issuance
    - Governance legitimacy
    - Committee selection

- **Restricted (Need-to-Know)**
  - Visibility limited to assignees, reviewers, and stewards
  - Used for:
    - Sensitive work (legal, HR, security)
    - Early-stage or exploratory tasks

  - COOK may still accrue, but:
    - Attestations are private by default
    - Public aggregation hides task-level detail

---

#### UX Rules & Safeguards

- Visibility level is set at the **board or project level**, not per-task (to reduce confusion)
- Changing visibility requires Steward action and is audit-logged
- Moving a task from Restricted → Team-Visible:
  - Triggers a notification
  - Preserves COOK history

---

#### Governance Implications

- **Public visibility increases legitimacy but does not grant power**
- Only Team-Visible or Restricted boards contribute to:
  - Governance weight
  - Committee eligibility

- Public boards are informational, not authoritative

---

### 6.3 Peer Review

- Required before COOK issuance
- Graduated rigor based on COOK value
- Commenting, objection, and escalation support

### 6.3 COOK Ledger, Earnings & Equity

- Maintain an immutable **COOK ledger** per contributor
- COOK is a non-transferable unit representing verified contribution
- Ledger supports:
  - Self-COOK vs Spend-COOK attribution
  - Time-based aggregation (monthly, yearly)
  - Velocity tracking (COOK/month)

- COOK totals feed into:
  - Governance weight
  - Equity calculations (e.g. slicing-style models)

- Support caps and decay functions to prevent dominance

### 6.4 Attestations

- Issue verifiable attestations on task completion
- Attestations reference:
  - Task
  - Contributor
  - Reviewer(s)
  - Value

- Attestations are portable across teams

### 6.5 Governance

- Governance weight derived directly from cumulative COOK
- Support **committee selection via weighted lottery**:
  - Eligibility requires active COOK in a recent window
  - Selection probability proportional to COOK earned

- Support exclusions:
  - People already serving
  - People under proposal review
  - Cooling-off periods after service

- Support service tracking:
  - Who served
  - When
  - For how long

- Objection windows precede any binding decision

### 6.6 AI Assistance

- Natural language task creation
- Review assistance (summaries, checklists)
- Retrospective drafting
- Playbook-aware responses

---

## 7. Non-Functional Requirements

### 7.1 Usability

- Mobile-first responsive UI
- Slack-first interaction model
- Minimal cognitive load

### 7.2 Security

- Role-based access control
- Immutable attestation records
- Audit logs for governance actions

### 7.3 Performance

- Near real-time updates
- Support small to medium teams (5–200 users)

### 7.4 Reliability

- Offline tolerance for field use (future)
- Graceful degradation if integrations fail

---

## 8. Technical Architecture

### 8.1 Frontend

- **Next.js (TypeScript)**
- **Material UI (MUI)** for component library
- Responsive, mobile-first design

### 8.2 Backend

- **Firebase**
  - Firestore for data storage
  - Firebase Auth for identity
  - Cloud Functions for business logic

### 8.3 Integrations (Production v1)

- Slack (bot + events)
- **GitHub (Issues + Projects) – first-class task and board integration**
- Internal task and ledger backend

### 8.4 Data Model (High-Level)

- User
- Team
- Task
- Review
- **COOK Ledger Entry**
- Attestation
- Governance Proposal
- Committee
- Service Term

---

## 9. Permissions & Roles

- **Contributor**: Create tasks, complete work, review peers
- **Reviewer**: Approve or object to work
- **Steward**: Governance escalation, configuration
- **Admin**: System configuration (limited, auditable)

---

## 10. Production Scope

### Included (Production)

- Slack bot (core interface)
- Web UI (Next.js + MUI)
- Task creation, assignment, and lifecycle management
- Peer review with graduated rigor
- Internal earnings ledger
- Attestation issuance and verification
- Governance roles, objection windows, and weighted voting
- Audit logs and transparency views

### Explicitly Out of Scope (v1 Production)

- Payroll processing
- Automated legal filings
- Fully offline-first mobile apps (web-first only)
- Token liquidity markets

---

## 11. Risks & Mitigations

| Risk               | Mitigation                        |
| ------------------ | --------------------------------- |
| Gaming the system  | Peer review + transparency        |
| Review bottlenecks | Graduated review rigor            |
| Governance fatigue | Default transparency, rare voting |
| Trust erosion      | Explainable AI, audit logs        |

---

## 12. Success Metrics

- Total COOK issued over time
- COOK velocity (per contributor / per team)
- % of COOK passing peer review without objection
- Distribution of COOK (anti-concentration health)
- Committee participation diversity
- Time-to-attestation

---

## 13. Open Questions

- COOK calibration standards across task types
- Maximum sustainable COOK velocity per person
- Decay or cooling mechanisms for historical COOK
- Legal interpretation of COOK relative to equity
- Public vs private visibility of COOK balances

---

## 14. Future Enhancements

- External task backend adapters
- Mobile offline mode
- Field-friendly interfaces (SMS)
- Public contributor profiles
- Cross-team reputation graphs

---

## 15. Appendix

- Governance playbook templates
- Onboarding flows
- Example team configurations
