---
name: writing-implementation-plans
description: Generates micro-granular implementation roadmaps for complex features. Use when moving from a design or brainstormed idea to actual code changes to ensure predictability and testability.
---

# Writing Implementation Plans

## When to use this skill
- After brainstorming is complete and you are ready to build.
- For complex refactoring or new feature development.
- When the user asks for a roadmap or "how we will build this".

## Workflow
1.  **Decomposition**: Break the feature into micro-tasks (2-5 minutes each).
2.  **TDD Priority**: Every logic change should start with a test task.
3.  **Standardized Formatting**: Create the plan in `docs/plans/YYYY-MM-DD-<name>.md`.
4.  **Verification**: Include specific validation steps (tests, manual checks) for every task.
5.  **Frequent Commits**: Map tasks to logic units suitable for individual commits.

## Instructions
- **Micro-Granularity**: If a task takes more than 5 minutes, it is too big. Break it down.
- **Specifics Only**: Mention exact file paths and code snippet locations.
- **Principles First**: Follow DRY (Don't Repeat Yourself) and YAGNI (You Ain't Gonna Need It).
- **Execution Loop**:
  - Write failing test.
  - Implement minimum code.
  - Verify pass.
  - Commit.

## Template
```markdown
# [Feature Name] Implementation Plan

## Tasks
- [ ] [Category] Task description <!-- id: 0 -->
    - [ ] Specific action (e.g., Update `App.tsx`) <!-- id: 1 -->
    - [ ] Verification step (e.g., Run `npm test`) <!-- id: 2 -->
- [ ] [Category] Next task <!-- id: 3 -->
```

## Resources
- [Superpowers writing-plans patterns](https://github.com/obra/superpowers/tree/main/skills/writing-plans)
