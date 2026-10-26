---
name: Source citation reliability
description: Why tutor citations select evidence IDs rather than copying source excerpts
---

The tutor should choose from server-owned evidence blocks, with structured output constrained to known IDs. Resolve the original excerpt and PDF page on the server and verify them before saving.

**Why:** Live model responses repeatedly produced too-short or altered quotes even when explicitly instructed to quote exactly. Rejecting all output made otherwise useful tutoring fail. Evidence selection preserves exact provenance without relying on the model's ability to reproduce PDF text.

**How to apply:** Preserve this approach when changing models, retrieval, extraction, or citation UI. Never repair a failed citation by inventing an excerpt or silently substituting an unrelated passage.

Keep evidence identities meaningful across requests (lecture/page/chunk), and isolate model history by both source and conversation session. A source switch must begin a new session, including when switching back to the same lecture.

**Why:** The user reported text from one lecture presented under another lecture's source context. The citation records passed exact-excerpt validation, but the tutor had been sent unrelated lecture history and reused generic evidence names across requests. Metadata validation alone cannot prevent old prose and context from being blended into a new lesson.

**How to apply:** Keep the source-switch regression alongside citation tests. Never reintroduce a notebook-wide history query into the tutor or let an old prepared greeting appear as the new source's conversation. Source labels belong to verified citation metadata, not independently generated prose.
