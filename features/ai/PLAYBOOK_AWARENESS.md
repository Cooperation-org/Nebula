# Playbook-Aware AI System

## Overview

The Cooperation Toolkit AI system is comprehensively playbook-aware across all AI features. This ensures that AI assistance aligns with team practices and guidelines throughout the system.

## Story 10B.4: Comprehensive Playbook-Aware AI Responses

**Status**: ✅ Complete

All AI features reference relevant playbooks for context and align responses with playbook guidelines.

## Playbook Integration

### Playbook Location

Playbooks are stored in: `features/ai/playbooks/`

Available playbooks:

- `task-creation.md` - Guidelines for task creation
- `review-assistance.md` - Guidelines for review assistance
- `retrospective.md` - Guidelines for retrospectives

### How Playbooks Are Used

1. **Automatic Loading**: When an AI function is called with a `teamId`, the system automatically loads the relevant playbook for that feature category.

2. **Context Injection**: Playbook content is injected into AI system prompts, providing context about team practices and guidelines.

3. **Transparent References**: AI responses can include playbook references and suggestions, making it clear when playbook guidelines influenced the response.

4. **Automatic Updates**: When playbooks are updated, AI responses automatically improve without code changes.

## AI Features with Playbook Awareness

### 1. Task Creation (Story 10A.1, 10A.2)

**Playbook**: `task-creation.md`

**Functions**:

- `extractTaskFromNaturalLanguage()` - Uses playbooks for task extraction
- `extractTaskWithOpenAI()` - ✅ Playbook-aware
- `extractTaskWithAnthropic()` - ✅ Playbook-aware

**Playbook Context**:

- Task structure guidelines
- COOK value estimation guidelines
- Task type classification
- Team-specific practices

**Output**:

- `playbookReferences`: Array of playbook sections referenced
- `playbookSuggestions`: Suggestions based on playbook patterns

### 2. Review Assistance - Summaries (Story 10B.1)

**Playbook**: `review-assistance.md`

**Functions**:

- `generateReviewSummary()` - Uses playbooks for review summaries
- `generateReviewSummaryWithOpenAI()` - ✅ Playbook-aware
- `generateReviewSummaryWithAnthropic()` - ✅ Playbook-aware

**Playbook Context**:

- Review process guidelines
- Review checklist items
- Effective review comments
- Objection guidelines

### 3. Review Assistance - Checklists (Story 10B.2)

**Playbook**: `review-assistance.md`

**Functions**:

- `generateReviewChecklist()` - Uses playbooks for checklist generation
- `generateReviewChecklistWithOpenAI()` - ✅ Playbook-aware
- `generateReviewChecklistWithAnthropic()` - ✅ Playbook-aware

**Playbook Context**:

- Review checklist templates
- Task-type-specific review items
- COOK-based rigor guidelines

### 4. Retrospectives (Story 10B.3)

**Playbook**: `retrospective.md`

**Functions**:

- `generateRetrospective()` - Uses playbooks for retrospective generation
- `generateRetrospectiveWithOpenAI()` - ✅ Playbook-aware
- `generateRetrospectiveWithAnthropic()` - ✅ Playbook-aware

**Playbook Context**:

- Retrospective format guidelines
- Analysis frameworks
- Team reflection practices

## Implementation Details

### Playbook Loading Function

```typescript
async function getRelevantPlaybooks(
  teamId?: string,
  category?: 'task-creation' | 'review-assistance' | 'retrospective'
): Promise<string>
```

**Behavior**:

- Reads playbook from filesystem (server-side only)
- Returns empty string if playbook doesn't exist (graceful degradation)
- Silently fails if file cannot be read (playbooks are optional)

### Playbook Context Injection

Playbook content is injected into AI system prompts using this pattern:

```typescript
const playbookContent = await getRelevantPlaybooks(teamId, 'category')
const playbookContext = playbookContent
  ? `\n\n## Category Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure responses follow team practices.`
  : ''
```

### Consistency Across Providers

Both OpenAI and Anthropic implementations use the same playbook integration pattern, ensuring consistent behavior regardless of AI provider.

## Benefits

1. **Team Alignment**: AI responses align with team practices and guidelines
2. **Consistency**: All AI features use playbooks consistently
3. **Transparency**: Playbook references are visible to users
4. **Automatic Improvement**: Playbook updates automatically improve AI responses
5. **Graceful Degradation**: System works even if playbooks are missing

## User Experience

### Playbook References in UI

- **Task Creation**: Shows playbook references and suggestions when AI extracts task information
- **Review Assistance**: Review summaries and checklists follow playbook guidelines
- **Retrospectives**: Retrospectives align with team reflection practices

### Transparency

Users can see when playbook guidelines influenced AI responses:

- Task creation shows `playbookReferences` and `playbookSuggestions`
- Review assistance follows playbook review guidelines
- Retrospectives use playbook reflection frameworks

## Future Enhancements

Potential improvements:

- Team-specific playbooks (per-team customization)
- Playbook versioning
- Playbook analytics (track which guidelines are most referenced)
- Dynamic playbook loading from database
- Playbook contribution workflow

## Verification

All AI functions have been verified to:

- ✅ Reference relevant playbooks for context
- ✅ Align responses with playbook guidelines
- ✅ Maintain consistency across all AI features
- ✅ Automatically improve when playbooks are updated
- ✅ Make playbook references transparent to users
