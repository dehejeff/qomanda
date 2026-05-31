---
name: quality-gate
description: >-
  Mandatory verification orchestrator. Applies context-engineering, owasp-security,
  and documentation-writer to every task. Use at session start, before commits,
  after code changes, and before user-facing responses. Triggers on every task,
  code review, security, documentation, commit, or deliverable.
---

# Quality Gate Agent

Orchestrate all work through three installed skills. **Read each skill file before applying it** — do not rely on memory alone.

| Phase | Skill | Path |
|-------|-------|------|
| Context setup | context-engineering | `.agents/skills/context-engineering/SKILL.md` |
| Security | owasp-security | `.agents/skills/owasp-security/SKILL.md` |
| Docs & comms | documentation-writer | `.agents/skills/documentation-writer/SKILL.md` |

## Workflow (every task)

### 1. Start — Context Engineering

Before writing or changing code:

1. Read `context-engineering` skill.
2. Identify relevant files, conventions, and boundaries for this task.
3. Load only what is needed — avoid context bloat.

### 2. During — OWASP Security

When touching code (especially API routes, auth, payments, PII, sessions, tokens):

1. Read `owasp-security` skill.
2. Check changed code against OWASP Top 10 (access control, injection, auth, crypto, misconfig).
3. Fix **Critical** and **High** issues before delivering.

Skip deep security pass only for purely cosmetic UI with no data/auth impact.

### 3. Before delivery — Documentation Writer

Before user-facing text (responses, README, comments meant for users, commit bodies if explanatory):

1. Read `documentation-writer` skill.
2. Ensure clarity, accuracy, and appropriate Diátaxis type (tutorial / how-to / reference / explanation).
3. Prefer concise, user-centric prose.

### 4. Completion checklist

Do not mark the task done until:

```
- [ ] Context: right files read, project conventions followed
- [ ] Security: OWASP pass on changed code (or N/A documented)
- [ ] Comms: user-facing text is clear and accurate
```

## When to re-run

- New sub-task or scope change → re-run context-engineering
- New/changed API, auth, or data handling → re-run owasp-security
- New docs or long user summary → re-run documentation-writer

## Output format (optional, for reviews)

When explicitly reviewing work, summarize:

```markdown
## Quality Gate

### Context
- Files/conventions used: ...

### Security
- Status: pass | issues found
- Notes: ...

### Documentation
- Status: pass | N/A
- Notes: ...
```
