
import OpenAI from "openai";
import { mkdir, writeFile } from "node:fs/promises";

const client = new OpenAI();

const today = new Date();
const date = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "2-digit",
}).format(today);

const filenameDate = date
  .toLowerCase()
  .replace(/,\s*/g, "-")
  .replace(/\//g, "");

const prompt = `
You are researching a British-English news podcast.

Today's date is ${today.toISOString().slice(0, 10)}.

Research one significant current international news
development using web search.

Write a short spoken-news test script of 150–200 words.

Requirements:
- Use verified, recent reporting.
- Explain what happened and why it matters.
- Distinguish facts from interpretation.
- Use a neutral, accessible narration style.
- Do not invent sources or quotations.
- Output spoken narration only, without markdown.
`;

console.log("Researching a short news test script...");

const response = await client.responses.create({
  model: "gpt-5-mini",
  tools: [{ type: "web_search" }],
  input: prompt,
  max_output_tokens: 3000,
});
console.log("Response status:", response.status);
console.log("Incomplete reason:", response.incomplete_details?.reason ?? "none");
console.log("Output types:", response.output?.map(item => item.type));
const script = response.output_text?.trim();

if (!script) {
  console.log("Response status:", response.status);
  console.log("Incomplete reason:", response.incomplete_details?.reason ?? "none");
  console.log("Output types:", response.output?.map(item => item.type));
  throw new Error("OpenAI did not return a completed script.");
}

await mkdir("scripts", { recursive: true });

const filename = `scripts/news-research-test.txt`;
await writeFile(filename, script + "\n", "utf8");

console.log(`Success! Script saved to ${filename}`);
console.log(`Characters: ${script.length}`);

