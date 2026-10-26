import { execFileSync } from "node:child_process";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const input = ".local/conversation-workspace/files/attached_assets";
const descriptions = {
  2: "Boolean operations, truth tables, composition, and PMOS/NMOS transistors.",
  3: "Combinational circuits, multiplexers, decoders, and building larger logic.",
  4: "Testing circuits systematically and writing clear, maintainable designs.",
  5: "Unsigned and signed binary integers, arithmetic, and two's complement.",
  6: "Hexadecimal notation, floating-point numbers, and ASCII characters.",
  7: "Latches, flip-flops, clocks, and storing a bit.",
  8: "Addressable memory, registers, and organizing stored information.",
  9: "States, transitions, and modeling sequential behavior.",
  10: "Applying finite state machines to a traffic-light controller.",
};
const lectures = readdirSync(input).filter(f => f.endsWith(".pdf")).sort().map((filename) => {
  const number = Number(filename.match(/Lecture_(\d+)/)?.[1]);
  const text = execFileSync("pdftotext", ["-layout", path.join(input, filename), "-"], {maxBuffer: 5_000_000}).toString();
  const pages = text.split("\f");
  if (!pages.at(-1)?.trim()) pages.pop();
  const title = filename.replace(/^CS_202_Lecture_\d+_–_/, "").replace(/_\d+\.pdf$/, "").replaceAll("_", " ");
  return {
    id: number, title: title.charAt(0).toUpperCase() + title.slice(1),
    lecture: `Lecture ${String(number).padStart(2, "0")}`,
    description: descriptions[number],
    pageCount: pages.length,
    pages: pages.map((text, i) => ({ page: i + 1, text: text.trim() })),
  };
});
mkdirSync("artifacts/api-server/src/data", {recursive:true});
writeFileSync("artifacts/api-server/src/data/lectures.json", JSON.stringify(lectures, null, 2));
console.log(lectures.map(l => `${l.lecture}: ${l.title} (${l.pageCount} pages)`).join("\n"));
