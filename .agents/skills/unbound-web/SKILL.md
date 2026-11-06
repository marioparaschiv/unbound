---
name: unbound-web
description: Prove and verify apps/web (unbound.rip and its /api/v1 API). Use when booting it locally signed in as any role, proving a change to its pages, endpoints, submissions, review or auth, or when a change touches review publishing (review.ts, submissions.ts, staging.ts, artifacts.ts, github.ts, the addon schema) and the model check must rerun.
metadata:
    internal: true
---

# apps/web

| Task                                                                           | Read                                                                                                        |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Boot a throwaway instance, sign in as a role, drive pages or the API           | [verify/README.md](verify/README.md), then the page's file in [verify/features/](verify/features/README.md) |
| A change to review publishing: can a rejected or tampered addon reach the CDN? | [review-publish/README.md](review-publish/README.md)                                                        |

Both run from scripts next to their README. `bun .agents/skills/unbound-web/review-publish/scripts/touched.ts` says in one line whether a change needs the model check.
