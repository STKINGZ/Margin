import { retrievePages, verifiedCitation } from "./course";

export function buildTutorEvidence(query: string, sourceId?: number | null) {
  return retrievePages(query, sourceId).flatMap(page => {
    const text = page.text.replace(/\s+/g, " ").trim();
    return Array.from({length: Math.ceil(text.length / 650)}, (_, index) => {
      const citation = verifiedCitation({
        sourceId: page.sourceId, page: page.page,
        excerpt: text.slice(index * 650, (index + 1) * 650),
      });
      if (!citation || citation.excerpt.length < 30) return [];
      // Globally meaningful IDs cannot be confused with another request's E1.
      return [{id: `L${page.sourceId}-P${page.page}-C${index + 1}`, citation}];
    }).flat();
  });
}

export function resolveTutorEvidence(ids: string[], evidence: ReturnType<typeof buildTutorEvidence>, sourceId?: number | null) {
  return [...new Set(ids)].map(id => {
    const chunk = evidence.find(e => e.id === id);
    if (!chunk || (sourceId != null && chunk.citation.sourceId !== sourceId)) {
      throw new Error("Tutor selected evidence outside the active source.");
    }
    // Resolve title, page and excerpt together. Neither model nor UI supplies metadata.
    const verified = verifiedCitation(chunk.citation);
    if (!verified) throw new Error("Tutor evidence no longer matches its original page.");
    return verified;
  });
}

export function isConfused(content: string) {
  return /\b(confus\w*|don['’]?t understand|do not understand|not understand|can['’]?t understand|cannot understand|i(?:['’]m| am) lost|not following|makes? no sense|too complicated)\b/i.test(content);
}

export function socraticViolation(reply: string, confused: boolean) {
  const count = reply.trim().split(/\s+/).length;
  if (count > (confused ? 60 : 130)) return "The reply is too long.";
  if ((reply.match(/\?/g) ?? []).length !== 1 || !reply.trim().endsWith("?")) return "End with exactly one simple checking question.";
  if (confused && reply.split(/\n\s*\n/).length > 2) return "Use only a first-step explanation and one question.";
  if (confused && /^\s*(?:[-*•]|\d+[.)])\s/m.test(reply)) return "Do not give a list of steps to a confused student.";
  return null;
}
