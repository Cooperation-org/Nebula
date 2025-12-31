# Task Workflow Guide

## Understanding COOK (Contribution Units)

**IMPORTANT**: COOK is NOT a currency that you spend or own before assigning it to tasks.

### How COOK Works:

1. **Assigning COOK to Tasks**: When you create or edit a task, you can assign a COOK value (e.g., 10 COOK). This is an **estimate** of the task's value - you don't need to "have" COOK to assign it.

2. **COOK States**:
   - **Draft**: COOK value is assigned but task hasn't started
   - **Provisional**: Task is "In Progress" - COOK value is frozen
   - **Locked**: Task is in "Review" - COOK value cannot be changed
   - **Final**: Task is "Done" and reviewed - COOK is finalized

3. **Earning COOK**: When a task is completed (moved to "Done" state) and all reviews are approved, COOK is **automatically issued** to the contributors. This is when you **earn** COOK, not when you assign it.

4. **COOK Attribution**:
   - **Self-COOK**: You assign the task to yourself
   - **Spend-COOK**: You assign the task to others (but you still don't "spend" anything - it's just a label)

### Example Workflow:

1. Create a task "Build login page" and assign 15 COOK to it
2. Work on the task (move to "In Progress") - COOK becomes "Provisional"
3. Submit for review (move to "Review") - COOK becomes "Locked"
4. Reviewers approve
5. Mark task as "Done" - COOK becomes "Final" and is **automatically issued** to you
6. You now have 15 COOK in your ledger (you earned it by completing the work)

## Task State Workflow

Tasks follow a strict sequential workflow:

```
Backlog → Ready → In Progress → Review → Done
```

### How to Change Task State:

**Option 1: Edit Task Form**

1. Click on a task in the task list
2. Or navigate to `/teams/{teamId}/tasks/{taskId}/edit`
3. Change the "State" dropdown
4. Save the task

**Option 2: Board View** (if implemented)

- Drag and drop tasks between columns

**Option 3: Slack Command**

```
/cook move <task-id> to <state>
```

### Marking Tasks as Completed:

1. **Prerequisites**:
   - Task must be in "Review" state
   - All required reviewers must have approved
   - Review status must be "approved"

2. **Steps**:
   - Go to Edit Task Form
   - Change state from "Review" to "Done"
   - Save the task
   - COOK will be automatically issued to contributors

## GitHub Integration

GitHub integration is **backend-only** and works via webhooks:

### How It Works:

1. **Setup** (Admin/Steward):
   - Configure GitHub webhook in repository settings
   - Map GitHub repositories to teams
   - Link GitHub usernames to Toolkit user accounts

2. **Automatic Sync**:
   - When you create a task in Toolkit, it can create a GitHub Issue (if configured)
   - When you move a task state in Toolkit, it syncs to GitHub Project columns
   - When you move a card in GitHub Projects, it syncs back to Toolkit

3. **Current Status**:
   - GitHub integration exists but has **no UI** yet
   - All configuration is done via Firebase Functions and environment variables
   - Tasks sync automatically if GitHub integration is configured

### Future UI Features (Not Yet Implemented):

- Link/unlink tasks to GitHub Issues
- View GitHub sync status
- Configure GitHub integration from UI
- Reconcile desync between GitHub and Toolkit

## Quick Actions Needed

The following UI improvements would make the workflow clearer:

1. **Quick State Change Buttons** in task list
2. **GitHub Integration UI** for linking tasks
3. **Better COOK Explanation** in create/edit forms
4. **One-Click "Mark as Done"** button when review is approved
