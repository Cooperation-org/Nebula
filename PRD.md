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
- **Work-Weighted Influence**: When voting happens, weight reflects contribution
- **Opportunity to Object**: Structured objection windows are built-in
- **Portability**: Contributors own their work history
- **Human-in-the-Loop AI**: AI assists, never governs

---

## 5. Core User Flows

### 5.1 Contribution Flow

1. Task Created
2. Provisional Value Assigned (points / hours / currency)
3. Work Performed
4. Peer Review
5. Value Finalized
6. Task Completed
7. Attestation Issued
8. Earnings / Equity / Governance Updated

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
- Support provisional value assignment
- Track task state transitions

### 6.2 Peer Review

- Required before completion (configurable)
- Lightweight acknowledgment for small tasks
- Formal review for high-value tasks
- Commenting and objection support

### 6.3 Earnings & Equity

- Maintain internal earnings ledger
- Support multiple equity calculation strategies:
  - Slicing-style dynamic equity
  - Tokenized equity (future)

- Exportable records

### 6.4 Attestations

- Issue verifiable attestations on task completion
- Attestations reference:
  - Task
  - Contributor
  - Reviewer(s)
  - Value

- Attestations are portable across teams

### 6.5 Governance

- Role definitions (Contributor, Steward, Reviewer)
- Governance weight derived from contributions
- Objection windows
- Vote triggering and tallying

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
- Internal task and ledger backend

### 8.4 Data Model (High-Level)

- User
- Team
- Task
- Review
- Attestation
- Ledger Entry
- Governance Proposal

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

- % of tasks with completed peer review
- Contributor retention
- Time-to-attestation
- Governance disputes per period
- Adoption by new teams

---

## 13. Open Questions

- Value calibration standards
- Contribution decay over time
- Legal framing of equity vs earnings
- Long-term funding model

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
