import lectures from "../data/lectures.json";
import type { SourceCitation } from "@workspace/db";

export const sources = lectures;
export const sourceSummaries = sources.map(({pages: _pages, ...source}) => source);
const normalized = (s: string) => s.replace(/\s+/g, " ").trim();

export function verifiedCitation(input: {sourceId:number;page:number;excerpt:string}, documents: typeof sources = sources): SourceCitation | null {
  const source = documents.find(s => s.id === input.sourceId);
  const page = source?.pages.find(p => p.page === input.page);
  if (!source || !page || input.excerpt.trim().length < 12 || !normalized(page.text).includes(normalized(input.excerpt))) return null;
  return {sourceId: source.id, sourceTitle: `${source.lecture}: ${source.title}`, page: input.page, excerpt: input.excerpt.trim()};
}

export const starterItems = [
  {
    kind: "concept", title: "The three Boolean operations",
    question: "What are the three basic Boolean operations, and when does each return 1?",
    answer: "NOT reverses its input. AND returns 1 only when both inputs are 1. OR returns 1 when at least one input is 1.",
    citations: [verifiedCitation({sourceId:2,page:1,excerpt:"he proposed three basic operations:\n   negation/inversion (NOT)\n   conjunction (AND)\n   disjunction (OR)"})!],
  },
  {
    kind: "terminology", title: "Composition",
    question: "What does composition mean in Boolean logic?",
    answer: "Composition means combining smaller operations or circuits to produce a larger one. Parentheses make the intended evaluation order explicit.",
    citations: [verifiedCitation({sourceId:2,page:2,excerpt:'composition is the act of combining together smaller things to produce bigger ones'})!],
  },
  {
    kind: "flashcard", title: "Exclusive OR (XOR)",
    question: "When is A XOR B true, and how is it different from OR?",
    answer: "XOR is true when exactly one input is true, but not both. OR is also true when both inputs are true.",
    citations: [verifiedCitation({sourceId:2,page:3,excerpt:'the idea is that it means "one or the other but not both"'})!],
  },
];

export const welcomeMessage = {
  role: "assistant",
  content: "Welcome to your CS 202 notebook.\n\nYour nine lectures take us from Boolean logic and transistors to memory and finite state machines. We’ll work through them one idea at a time, with short checks before moving on.\n\nA starting idea from Lecture 02: Boolean logic uses two values—0 and 1. NOT flips a value, AND needs both inputs to be 1, and OR needs at least one.\n\nTry a quick check: if A = 1 and B = 0, what are A AND B and A OR B?\n\nI’ve put three source-linked starter items in your review queue. Nothing enters your library until you approve it.",
  citations: starterItems[0]!.citations,
};

export function retrievePages(query: string, sourceId?: number | null, documents: typeof sources = sources) {
  const active=sourceId?documents.filter(s=>s.id===sourceId):documents;
  if(sourceId&&!query.trim()) return active.flatMap(s=>s.pages.map(p=>({...p,sourceId:s.id,sourceTitle:s.title})));
  const words = new Set(query.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length > 2) ?? []);
  const pages = active.flatMap(s => s.pages.map(p => {
    const text = `${s.title} ${p.text}`.toLowerCase();
    const score = [...words].reduce((n, w) => n + (text.includes(w) ? 1 : 0) + (s.title.toLowerCase().includes(w) ? 4 : 0), 0);
    return {...p, sourceId:s.id, sourceTitle:s.title, score};
  }));
  return pages.sort((a,b) => b.score-a.score || a.sourceId-b.sourceId || a.page-b.page).slice(0,12);
}
