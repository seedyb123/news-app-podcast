
import OpenAI from "openai";
import { mkdir, readFile, readdir, writeFile, open } from "node:fs/promises";
import path from "node:path";

// Creates one narration script per London calendar day.
// Audio generation and publishing will be connected next.

const client = new OpenAI({ maxRetries: 0 });
const model = process.env.NEWS_MODEL || "gpt-5-mini";

const now = new Date();
const parts = Object.fromEntries(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  })
    .formatToParts(now)
    .filter(p => p.type !== "literal")
    .map(p => [p.type, p.value])
);

const day = parts.weekday.toLowerCase();
const dateCode = `${parts.day}${parts.month}${parts.year}`;
const isoDate = `20${parts.year}-${parts.month}-${parts.day}`;

const outputFile = path.join(
  "scripts",
  `${day}-${dateCode}-news.txt`
);

const attemptFile = path.join(
  ".news-runs",
  `${dateCode}.attempt`
);

const themes = {
  monday: "World & Geopolitics",
  tuesday: "Business & Economics",
  wednesday: "Technology & AI",
  thursday: "Work, Society & Policy",
  friday: "Ideas & Long-form Analysis",
  saturday: "Culture, Science & Discovery",
  sunday: "Missed News: Around the World"
};

const editorialPlan = await readFile(
  "editorial-plan.md",
  "utf8"
);

await mkdir("scripts", { recursive: true });
await mkdir(".news-runs", { recursive: true });

// Prevent a second local attempt for the same date.
// GitHub Actions must also persist this record later.

try {
  const attempt = await open(attemptFile, "wx");
  await attempt.writeFile(
    `Started ${new Date().toISOString()}\n`
  );
  await attempt.close();
} catch (error) {
  if (error.code === "EEXIST") {
    console.log(
      `Already attempted ${dateCode}. No second run.`
    );
    process.exit(0);
  }
  throw error;
}

function extractCitedUrls(response) {
  return new Set(
    (response.output || [])
      .filter(item => item.type === "message")
      .flatMap(item => item.content || [])
      .flatMap(item => item.annotations || [])
      .filter(
        annotation => annotation.type === "url_citation"
      )
      .map(annotation => annotation.url)
  );
}

try {
  const previousFiles = (await readdir("scripts"))
    .filter(name =>
      /-news\.txt$/.test(name) &&
      name !== path.basename(outputFile)
    )
    .slice(-6);

  const previousSummaries = [];

  for (const filename of previousFiles) {
    const body = await readFile(
      path.join("scripts", filename),
      "utf8"
    );

    previousSummaries.push(
      `${filename}: ${body.slice(0, 1800)}`
    );
  }

  console.log(
    `Researching ${day} (${isoDate}): ${themes[day]}`
  );

  const research = await client.responses.create({
    model,
    tools: [{ type: "web_search" }],
    max_output_tokens: 9000,

    input: `
Today's London date: ${isoDate}.
Today's editorial theme: ${themes[day]}.

EDITORIAL SPECIFICATION:
${editorialPlan}

TASK:
Research today's news according to this specification.

This is a research stage only. Do not write
the podcast narration yet.

For Monday to Saturday:
Research all seven mandatory publications
and five additional relevant publications.

For Sunday:
Research original local reporting across the
specified 17-country pool. Exclude the seven
mandatory weekday publications.

Use live web search.

Prioritise consequential verified developments
from the preceding seven days.

For factual claims, identify supporting
reporting or primary evidence.

Record article URLs and publication dates
within your research response.

Do not claim to have read inaccessible articles.

Distinguish independent corroboration from
syndicated copies of the same reporting.

If there is insufficient verifiable material,
state that clearly.

Avoid repeating previous episodes.

PREVIOUS EPISODES:
${previousSummaries.join("\n\n") || "None"}

Return concise structured research, including
sources consulted, sources used, developments,
evidence and limitations.

This research is an internal intermediate
step. Do not create separate research files.
`
  });

  const searchCalls =
    research.output?.filter(
      item => item.type === "web_search_call"
    ).length ?? 0;

  if (
    research.status !== "completed" ||
    !research.output_text?.trim() ||
    searchCalls < 1
  ) {
    console.error("Research response diagnostics:");
    console.error("Status:", research.status);
    console.error(
      "Incomplete reason:",
      research.incomplete_details?.reason ?? "none"
    );
    console.error("Web search calls:", searchCalls);
    console.error(
      "Output types:",
      research.output?.map(item => item.type) ?? []
    );
    console.error(
      "Has research text:",
      Boolean(research.output_text?.trim())
    );

    throw new Error(
      "Research did not finish successfully."
    );
  }

  const urls = extractCitedUrls(research);

  if (urls.size < 3) {
    throw new Error(
      `Only ${urls.size} cited URLs found. ` +
      "Refusing to create an unsourced script."
    );
  }

  console.log(
    `Drafting narration from research ` +
    `containing ${urls.size} cited URLs...`
  );

  const draft = await client.responses.create({
    model,
    max_output_tokens: 10000,

    input: `
Write today's full, single-narrator,
British-English news podcast script.

TODAY:
${isoDate}
${day}
${themes[day]}

EDITORIAL SPECIFICATION:
${editorialPlan}

RESEARCH:
${research.output_text}

Follow the editorial specification exactly.

Use only developments and claims supported
by the supplied research.

Do not introduce additional unverified facts,
sources, stories or quotations.

If adequate supporting research is unavailable,
output exactly:

INSUFFICIENT VERIFIED RESEARCH

Name every publication actually relied upon
in the opening narration.

Use the six-part format Monday to Saturday.
Use the special Sunday format on Sundays.

Maximum duration: 22 minutes.
Approximately 3,000 spoken words at most.
Shorter is preferable if the news warrants it.

Return spoken narration ONLY.

Do not include:
- Markdown headings
- URLs
- Citation markers
- Research notes
- Production commentary
- Stage directions
`
  });

  if (
    draft.status !== "completed" ||
    !draft.output_text?.trim()
  ) {
    throw new Error(
      "Narration response was incomplete."
    );
  }

  const script = draft.output_text
    .trim()
    .replace(/\r\n/g, "\n");

  const words = script
    .split(/\s+/)
    .filter(Boolean)
    .length;

  if (
    script.includes(
      "INSUFFICIENT VERIFIED RESEARCH"
    )
  ) {
    throw new Error(
      "Insufficient research. No script created."
    );
  }

  if (
    words < 350 ||
    words > 3300 ||
    /https?:\/\/|www\.|\[\d+\]|【|\*\*|```/.test(script)
  ) {
    throw new Error(
      `Script validation failed: ${words} words.`
    );
  }

  await writeFile(
    outputFile,
    script + "\n",
    {
      encoding: "utf8",
      flag: "wx"
    }
  );

  console.log(
    `Created ${outputFile}`
  );

  console.log(
    `${words} words, ${script.length} characters`
  );

  console.log(
    "Script generation complete."
  );

} catch (error) {
  console.error(
    `Daily generation stopped: ${error.message}`
  );

  process.exitCode = 1;
}
