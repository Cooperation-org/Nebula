# Cooperation Toolkit (Nebula)

> Enable any team to share ownership and governance equitably through **earned contribution**, not capital ownership.

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue)](https://react.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-12.7-orange)](https://firebase.google.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![Material UI](https://img.shields.io/badge/MUI-7.3-blue)](https://mui.com/)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Development](#development)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

---

## 🎯 Overview

The Cooperation Toolkit provides composable infrastructure for task tracking, peer review, attestation, and equity/governance updates. It enables teams to share ownership and governance equitably through **earned contribution** (COOK), preserving team purpose and preventing capture.

### Core Principles

- **Earned Governance**: Authority accrues through valuable work

- **Transparency over Permission**: Visibility replaces constant voting

- **Work-Weighted Influence**: Influence is proportional to earned contribution units (COOK)

- **Opportunity to Object**: Structured objection windows are built-in

- **Anti-Capture by Design**: Governance power cannot be purchased or transferred, only earned

- **Portability**: Contributors own their work history and attestations

### Problem Statement

Traditional organizational structures:

- Concentrate power via capital rather than contribution
- Fail to fairly reward early or underfunded contributors
- Are vulnerable to mission drift, hostile takeover, or silent capture
- Provide little portable proof of real work for contributors

The Cooperation Toolkit solves this by providing a **contribution-to-governance pipeline** where work is tracked, valued, reviewed, and automatically updates governance weight and equity.

## ✨ Features

### Foundation & Core Features

- ✅ **User Management & Authentication** - Firebase Auth with email/password
- ✅ **Team Management** - Create teams, assign roles (Contributor, Reviewer, Steward, Admin)
- ✅ **Task Management** - Full task lifecycle with states (Backlog → Ready → In Progress → Review → Done)
- ✅ **COOK Valuation System** - Assign COOK values to tasks, track through workflow
- ✅ **Peer Review Workflow** - Multi-reviewer system with COOK-based reviewer requirements
- ✅ **Project Boards** - Customizable boards with visibility levels (Public, Team-Visible, Restricted)
- ✅ **Security Rules** - Role-based access control with Firestore security rules

### Advanced Features

- ✅ **GitHub Integration** - First-class GitHub Projects integration with bidirectional sync
- ✅ **COOK Ledger & Attestations** - Immutable ledger, verifiable attestations with Merkle tree hashing
- ✅ **Governance System** - COOK-weighted voting, objection windows, committee selection via weighted lottery
- ✅ **AI Assistance** - Natural language task creation, review summaries, checklists, retrospectives
- ✅ **Slack Integration** - Primary interface via Slack commands and real-time notifications

### Key Capabilities

**Task Management:**

- Create, update, and track tasks with COOK values
- Sequential state transitions with validation
- Task archiving and restoration
- GitHub Projects synchronization

**COOK System:**

- COOK states: Draft → Provisional → Locked → Final
- COOK caps to prevent dominance
- COOK decay functions for time-based weighting
- COOK velocity tracking
- Time-based aggregation (monthly/yearly)

**Review System:**

- Multi-reviewer requirements based on COOK value
- Review actions: Approve, Object, Comment, Escalate
- AI-generated review summaries and checklists
- Review progress tracking

**Governance:**

- Governance weight derived from cumulative COOK
- COOK-weighted voting and objections
- Objection windows with automatic voting triggers
- Committee selection via weighted lottery
- Policy and constitutional change tracking
- Comprehensive audit logs

**Attestations:**

- Verifiable attestations on task completion
- Merkle tree hashing for cryptographic verification
- Portable across teams
- Immutable and auditable

**AI Features:**

- Natural language task creation
- Playbook-aware task suggestions
- AI-generated review summaries
- AI-generated review checklists
- AI-generated team retrospectives

**Slack Integration:**

- `/cook` slash commands for all operations
- Real-time notifications for events
- Task management via Slack
- COOK tracking via Slack
- Review workflow via Slack
- Governance actions via Slack

## 🛠 Tech Stack

### Frontend

- **Next.js 16.1** - React framework with App Router
- **React 19.2** - UI library
- **TypeScript 5.0** - Type safety
- **Material UI 7.3** - Component library
- **Zustand 5.0** - State management
- **Zod 4.2** - Schema validation

### Backend

- **Firebase Firestore** - NoSQL database
- **Firebase Auth** - Authentication
- **Firebase Cloud Functions** - Serverless functions
- **Firestore Security Rules** - Database-level security

### Integrations

- **GitHub API** - GitHub Projects integration
- **Slack API** - Slack bot and notifications
- **OpenAI/Anthropic** - AI services

### Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **TypeScript** - Type checking

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Firebase account and project
- (Optional) OpenAI or Anthropic API key for AI features
- (Optional) Slack app for Slack integration
- (Optional) GitHub app for GitHub integration

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Nebula
   ```

2. **Install dependencies**

   ```bash
   npm install
   cd functions && npm install && cd ..
   ```

3. **Set up Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Firestore, Authentication (Email/Password)
   - Get your Firebase config from Project Settings > General > Your apps

4. **Configure environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your Firebase configuration. See [Environment Variables](#environment-variables) for details.

5. **Set up Firestore security rules**

   ```bash
   firebase deploy --only firestore:rules
   ```

6. **Run development server**

   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### First-Time Setup

1. **Register an account** at `/register`
2. **Complete onboarding** - Interactive tutorial covering key features
3. **Create or join a team** - Start using the Cooperation Toolkit

## 💻 Development

### Project Structure

```
Nebula/
├── app/                    # Next.js App Router pages
│   ├── (auth)/            # Authentication pages
│   ├── (dashboard)/       # Dashboard pages
│   │   ├── onboarding/   # User onboarding flow
│   │   ├── profile/      # User profile
│   │   └── teams/        # Team management
│   ├── api/               # API routes
│   └── page.tsx           # Landing page
├── components/             # React components
├── lib/                   # Shared libraries
│   ├── firebase/          # Firebase helpers
│   ├── schemas/           # Zod schemas
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   └── permissions/       # Permission system
├── functions/             # Firebase Cloud Functions
│   └── src/
│       ├── http/          # HTTP functions (Slack, GitHub)
│       ├── triggers/      # Firestore triggers
│       └── shared/        # Shared utilities
├── features/              # Feature-specific code
│   └── ai/               # AI-related features
└── firestore.rules        # Firestore security rules
```

### Available Scripts

**Next.js (Root):**

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

**Firebase Functions:**

```bash
cd functions
npm run build        # Build TypeScript
npm run serve        # Start emulator
npm run deploy       # Deploy functions
```

### Development Workflow

1. **Start Firebase Emulators** (optional)

   ```bash
   firebase emulators:start
   ```

2. **Start Next.js dev server**

   ```bash
   npm run dev
   ```

3. **Make changes** - Files auto-reload on save

4. **Run linter**

   ```bash
   npm run lint
   ```

5. **Format code**
   ```bash
   npm run format
   ```

### Code Style

- **TypeScript** - Strict mode enabled
- **ESLint** - Next.js recommended config
- **Prettier** - Automatic code formatting
- **Zod** - Schema validation for all data
- **Material UI** - Component library standards

### Testing

Currently, the project uses manual testing. Test coverage includes:

- User authentication and registration
- Task creation and state transitions
- COOK assignment and ledger
- Review workflow
- Governance actions
- Slack commands
- GitHub integration

## 🔐 Environment Variables

See [ENV_VARIABLES.md](./ENV_VARIABLES.md) for complete documentation.

### Required Variables

**Firebase (Next.js):**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

**AI Service (Next.js):**

```bash
AI_PROVIDER=openai  # or 'anthropic' or 'gemini'
OPENAI_API_KEY=sk-...  # if using OpenAI
ANTHROPIC_API_KEY=sk-ant-...  # if using Anthropic
GEMINI_API_KEY=your-gemini-api-key  # if using Gemini
# Optional: Model selection
# OPENAI_MODEL=gpt-4o-mini
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
# GEMINI_MODEL=gemini-1.5-pro
```

**Application URL:**

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or production URL
```

**Firebase Functions:**
Set via `firebase functions:config:set`:

```bash
slack.signing_secret=...
slack.bot_token=xoxb-...
github.webhook_secret=...
```

### Quick Setup

1. Copy `.env.example` to `.env.local`
2. Fill in Firebase configuration
3. Add AI API keys (optional)
4. Set `NEXT_PUBLIC_APP_URL`
5. Configure Firebase Functions variables

## 🏗 Architecture

### High-Level Architecture

```
┌─────────────────┐
│   Next.js App   │  (Frontend - Vercel)
│   (React/TS)    │
└────────┬────────┘
         │
         ├──► Firebase Auth
         ├──► Firestore (Database)
         └──► Cloud Functions
                  │
                  ├──► Slack Bot
                  ├──► GitHub Webhooks
                  └──► Firestore Triggers
```

### Data Model

**Root Collections:**

- `users` - User profiles
- `teams` - Team information
- `governanceProposals` - Governance proposals
- `voting` - Voting instances
- `attestations` - Verifiable attestations

**Team Subcollections:**

- `teams/{teamId}/tasks` - Tasks
- `teams/{teamId}/cookLedger` - COOK ledger entries
- `teams/{teamId}/reviews` - Reviews
- `teams/{teamId}/boards` - Project boards
- `teams/{teamId}/governanceWeights` - Governance weights
- `teams/{teamId}/equity` - Equity calculations
- `teams/{teamId}/committees` - Committee selections
- `teams/{teamId}/serviceTerms` - Service term tracking
- `teams/{teamId}/auditLogs` - Audit logs

### Key Design Patterns

- **Canonical System of Record** - Toolkit state is source of truth

- **Governance-by-Workflow** - Implicit consent through workflow

- **Immutable Ledgers** - COOK ledger and attestations are append-only

- **Role-Based Access Control** - Contributor, Reviewer, Steward, Admin

- **Mobile-First Design** - Responsive UI with Material UI

## 🚢 Deployment

### CI/CD Pipeline

The project uses GitHub Actions for automated deployment. See [.github/workflows/README.md](.github/workflows/README.md).

**Workflow:**

1. Lint and type-check on PR
2. Build Next.js app
3. Build Cloud Functions
4. Deploy to Vercel (Next.js)
5. Deploy to Firebase (Functions + Rules)

### Manual Deployment

**Deploy Next.js to Vercel:**

```bash
vercel deploy
```

**Deploy Firebase Functions:**

```bash
cd functions
npm run build
firebase deploy --only functions
```

**Deploy Firestore Rules:**

```bash
firebase deploy --only firestore:rules
```

### Production Checklist

- [ ] Set all environment variables in Vercel
- [ ] Configure Firebase Functions environment variables
- [ ] Deploy Firestore security rules
- [ ] Set up Slack app webhook URL
- [ ] Set up GitHub webhook URL
- [ ] Configure domain (if custom)
- [ ] Set up monitoring and logging
- [ ] Test all integrations

---

## 📚 Documentation

### Project Documentation

- **[PRD.md](./PRD.md)** - Product Requirements Document
- **[Architecture.md](./_bmad-output/planning-artifacts/architecture.md)** - Technical architecture
- **[Epics.md](./_bmad-output/planning-artifacts/epics.md)** - Feature breakdown
- **[ENV_VARIABLES.md](./ENV_VARIABLES.md)** - Environment variables reference

### Feature Documentation

- **[Firebase README](./lib/firebase/README.md)** - Firebase setup and usage
- **[Functions README](./functions/README.md)** - Cloud Functions documentation
- **[Slack Integration](./functions/src/http/slack/README.md)** - Slack bot setup
- **[GitHub Integration](./functions/src/http/github/README.md)** - GitHub integration
- **[AI Setup](./AI_SETUP.md)** - AI service configuration
- **[CI/CD Workflows](./.github/workflows/README.md)** - Deployment workflows

### Code Documentation

- **Schemas** - Zod schemas in `lib/schemas/`
- **Types** - TypeScript types in `lib/types/`
- **Firebase Helpers** - Functions in `lib/firebase/`
- **Utilities** - Helper functions in `lib/utils/`

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run linter and formatter
5. Test your changes
6. Submit a pull request

### Code Standards

- Follow TypeScript best practices
- Use Zod for all data validation
- Write clear, descriptive commit messages
- Add comments for complex logic
- Follow existing code style

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add changelog entry (if applicable)
4. Request review from maintainers

## 📝 License

[Add your license here]

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [Material UI](https://mui.com/)
- Backend powered by [Firebase](https://firebase.google.com/)
- AI services by [OpenAI](https://openai.com/) and [Anthropic](https://www.anthropic.com/)

## 📞 Support

For questions, issues, or contributions:

- Open an issue on GitHub
- Check the documentation
- Review the PRD and architecture docs

---

**Built with ❤️ for equitable team governance**
