# Task Creation Playbook

## Overview

This playbook provides guidelines for creating tasks in the Cooperation Toolkit. Tasks should be well-defined, actionable, and aligned with team practices.

## Task Structure

### Title Guidelines

- **Concise**: 5-10 words maximum
- **Action-oriented**: Start with a verb (e.g., "Create", "Implement", "Update")
- **Specific**: Avoid vague terms like "fix" or "improve" without context
- **Clear scope**: Indicate what is being worked on

**Examples:**
- ✅ "Create user authentication API endpoint"
- ✅ "Implement password reset functionality"
- ❌ "Fix login"
- ❌ "Improve system"

### Description Guidelines

- **Context**: Explain why this task is needed
- **Requirements**: List specific requirements or acceptance criteria
- **Dependencies**: Note any dependencies on other tasks or systems
- **Technical details**: Include relevant technical information
- **Success criteria**: Define what "done" looks like

### COOK Value Estimation

COOK values should reflect the complexity, effort, and impact of the task:

- **Small (1-10 COOK)**: Simple tasks, bug fixes, minor updates
  - Examples: Fix typo, update documentation, small UI tweak
- **Medium (11-30 COOK)**: Standard feature work, moderate complexity
  - Examples: New API endpoint, feature implementation, integration work
- **Large (31-60 COOK)**: Complex features, significant refactoring
  - Examples: Major feature, system redesign, complex integration
- **Extra Large (61-100 COOK)**: Major initiatives, architectural changes
  - Examples: New system, major migration, complete rewrite

### Task Type Guidelines

- **Build**: Development work, coding, feature implementation
  - Examples: Create API, implement feature, write tests
- **Ops**: Infrastructure, deployment, operations
  - Examples: Set up CI/CD, configure server, deploy application
- **Governance**: Policy, process, organizational work
  - Examples: Update policy, create process, governance decision
- **Research**: Investigation, analysis, learning
  - Examples: Research technology, analyze requirements, study best practices

## Best Practices

1. **Break down large tasks**: If a task is >60 COOK, consider breaking it into smaller tasks
2. **Clear acceptance criteria**: Always include clear acceptance criteria in the description
3. **Assign appropriate reviewers**: Select reviewers with relevant expertise
4. **Link related tasks**: Reference related tasks in the description
5. **Update status regularly**: Keep task state current as work progresses

## Common Patterns

### Feature Development Task

```
Title: [Action] [Feature Name] [Component/Area]

Description:
## Context
[Why this feature is needed]

## Requirements
- [Requirement 1]
- [Requirement 2]

## Technical Details
[Relevant technical information]

## Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
```

### Bug Fix Task

```
Title: Fix [Issue] in [Component]

Description:
## Issue
[Description of the bug]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]

## Expected Behavior
[What should happen]

## Actual Behavior
[What actually happens]

## Solution
[Proposed fix]
```

### Research Task

```
Title: Research [Topic] for [Purpose]

Description:
## Research Question
[What needs to be researched]

## Context
[Why this research is needed]

## Deliverables
- [ ] [Deliverable 1]
- [ ] [Deliverable 2]

## Timeline
[Expected completion date]
```

