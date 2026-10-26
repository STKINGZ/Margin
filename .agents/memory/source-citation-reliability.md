---
name: Source citation reliability
description: Why tutor citations select evidence IDs rather than copying source excerpts
---

The tutor should choose from server-owned evidence blocks, with structured output constrained to known IDs. Resolve the original excerpt and PDF page on the server and verify them before saving.

**Why:** Live model responses repeatedly produced too-short or altered quotes even when explicitly instructed to quote exactly. Rejecting all output made otherwise useful tutoring fail. Evidence selection preserves exact provenance without relying on the model's ability to reproduce PDF text.

**How to apply:** Preserve this approach when changing models, retrieval, extraction, or citation UI. Never repair a failed citation by inventing an excerpt or silently substituting an unrelated passage.
