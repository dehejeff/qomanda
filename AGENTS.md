<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Quality Gate (mandatory)

All agent work is verified through the **quality-gate** orchestrator in `.agents/skills/quality-gate/SKILL.md`.

Before coding, read that skill. It applies:

| Skill | When |
|-------|------|
| `context-engineering` | Session start, new task |
| `owasp-security` | API, auth, payments, PII, sessions |
| `documentation-writer` | User-facing docs and summaries |

Cursor rule: `.cursor/rules/quality-gate.mdc` (always applied).

Sensitive paths for OWASP review: `src/app/api/**`, `src/lib/customer-*`, payment/Asaas code.
