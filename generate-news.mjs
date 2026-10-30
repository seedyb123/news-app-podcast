import OpenAI from "openai";
import { mkdir, readFile, readdir, writeFile, open } from "node:fs/promises";
import path from "node:path";

// Escape the Cave: one attempt per London day. Source searches are audited
// independently from editorial selection. Logs are persisted by GitHub Actions.
const client = new OpenAI({ maxRetries: 1 });
const model = process.env.NEWS_MODEL || "gpt-5-mini";
const now = new Date();
const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London", weekday: "long", day: "2-digit",
  month: "2-digit", year: "2-digit"
}).formatToParts(now).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
const day = parts.weekday.toLowerCase();
const dateCode = `${parts.day}${parts.month}${parts.year}`;
const isoDate = `20${parts.year}-${parts.month}-${parts.day}`;
const outputFile = path.join("scripts", `${day}-${dateCode}-news.txt`);
const logFile = path.join("source-logs", `${dateCode}.json`);
const attemptFile = path.join(".news-runs", `${dateCode}.attempt`);
const themes = {
  monday: "World & Geopolitics", tuesday: "Business & Economics",
  wednesday: "Technology & AI", thursday: "Work, Society & Policy",
  friday: "Ideas & Long-form Analysis", saturday: "Culture, Science & Discovery",
  sunday: "Missed News: Around the World"
};

// Stable identifiers are needed for comparable longitudinal metrics.
// Supplementary outlets rotate by theme; the model chooses five distinct
// candidates from this curated pool, excluding the seven core outlets.
const core = [
  { name: "BBC", domains: ["bbc.com", "bbc.co.uk"] },
  { name: "CNN", domains: ["cnn.com"] },
  { name: "Financial Times", domains: ["ft.com"] },
  { name: "The Guardian", domains: ["theguardian.com"] },
  { name: "The Wall Street Journal", domains: ["wsj.com"] },
  { name: "The Economist", domains: ["economist.com"] },
  { name: "Al Jazeera", domains: ["aljazeera.com"] }
];
const extra = [
  { name: "Reuters", domains: ["reuters.com"] },
  { name: "Associated Press", domains: ["apnews.com"] },
  { name: "NPR", domains: ["npr.org"] },
  { name: "Deutsche Welle", domains: ["dw.com"] },
  { name: "France 24", domains: ["france24.com"] },
  { name: "Rest of World", domains: ["restofworld.org"] },
  { name: "MIT Technology Review", domains: ["technologyreview.com"] },
  { name: "Nature", domains: ["nature.com"] },
  { name: "Science", domains: ["science.org"] },
  { name: "Nikkei Asia", domains: ["asia.nikkei.com"] },
  { name: "The Conversation", domains: ["theconversation.com"] },
  { name: "El País", domains: ["elpais.com"] },
  { name: "The Hindu", domains: ["thehindu.com"] },
  { name: "South China Morning Post", domains: ["scmp.com"] },
  { name: "The Africa Report", domains: ["theafricareport.com"] },
  { name: "New Scientist", domains: ["newscientist.com"] },
  { name: "Bloomberg", domains: ["bloomberg.com"] },
  { name: "The Atlantic", domains: ["theatlantic.com"] }
];
// Sunday retains the separate, local-reporting-first policy. These are
// specific search targets, not a claim that every country must make the show.
const sunday = [
  { name: "Argentina — La Nación", domains: ["lanacion.com.ar"] },
  { name: "Brazil — Folha de S.Paulo", domains: ["folha.uol.com.br"] },
  { name: "Canada — CBC", domains: ["cbc.ca"] },
  { name: "Mexico — Animal Político", domains: ["animalpolitico.com"] },
  { name: "France — Le Monde", domains: ["lemonde.fr"] },
  { name: "Germany — Deutsche Welle", domains: ["dw.com"] },
  { name: "Italy — ANSA", domains: ["ansa.it"] },
  { name: "Russia — Meduza", domains: ["meduza.io"] },
  { name: "China — Caixin", domains: ["caixinglobal.com"] },
  { name: "India — The Hindu", domains: ["thehindu.com"] },
  { name: "Indonesia — The Jakarta Post", domains: ["thejakartapost.com"] },
  { name: "Japan — Nikkei Asia", domains: ["asia.nikkei.com"] },
  { name: "South Korea — Yonhap", domains: ["en.yna.co.kr"] },
  { name: "Saudi Arabia — Arab News", domains: ["arabnews.com"] },
  { name: "Türkiye — Hürriyet Daily News", domains: ["hurriyetdailynews.com"] },
  { name: "South Africa — Daily Maverick", domains: ["dailymaverick.co.za"] },
  { name: "Australia — ABC News", domains: ["abc.net.au"] }
];

const editorialPlan = await readFile("editorial-plan.md", "utf8");
await Promise.all([mkdir("scripts", { recursive: true }), mkdir(".news-runs", { recursive: true }), mkdir("source-logs", { recursive: true })]);
const audit = { date: isoDate, theme: themes[day], generated_at: new Date().toISOString(),
  status: "started", search_targets: [], totals: {}, failure: null,
  note: "No relevant results means a completed search explicitly returned none. Incomplete requests and lack of URL annotations are not evidence of publication failure." };
let auditWrite = Promise.resolve();
async function saveAudit() {
  audit.updated_at = new Date().toISOString();
  audit.totals = {
    targets: audit.search_targets.length,
    searched: audit.search_targets.filter(x => x.search_calls > 0).length,
    no_relevant_results: audit.search_targets.filter(x => x.outcome === "no_relevant_results").length,
    found: audit.search_targets.filter(x => x.outcome === "found").length,
    search_or_access_problem: audit.search_targets.filter(x => x.outcome === "search_or_access_problem").length
  };
  const snapshot = JSON.stringify(audit, null, 2) + "\n";
  auditWrite = auditWrite.then(() => writeFile(logFile, snapshot, "utf8"));
  await auditWrite;
}

// Local anti-repeat guard. The committed workflow guard is authoritative.
try {
  const attempt = await open(attemptFile, "wx");
  await attempt.writeFile(`Started ${new Date().toISOString()}\n`);
  await attempt.close();
} catch (error) {
  if (error.code === "EEXIST") {
    console.log(`Already attempted ${dateCode}. No second run.`);
    process.exit(0);
  }
  throw error;
}

// Capture both the citations attached to answers and the search tool's
// consulted-source records. A search-tool URL is evidence of a real source
// being returned, but not proof that its full article body was accessed.
function citations(response) {
  return [...new Set((response.output || [])
    .filter(item => item.type === "message")
    .flatMap(item => item.content || [])
    .flatMap(item => item.annotations || [])
    .filter(item => item.type === "url_citation" && typeof item.url === "string")
    .map(item => item.url))];
}
function consultedSources(response) {
  return [...new Set((response.output || [])
    .filter(item => item.type === "web_search_call")
    .flatMap(item => item.action?.sources || [])
    .map(item => typeof item === "string" ? item : item?.url)
    .filter(url => typeof url === "string" && /^https?:\/\//i.test(url)))];
}
function domainMatches(url, domains) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
}
function uniqueUrls(urls) {
  return [...new Set(urls.filter(url => {
    try { return ["https:", "http:"].includes(new URL(url).protocol); }
    catch { return false; }
  }))];
}
function sourceCount(response) {
  return response.output?.filter(item => item.type === "web_search_call").length ?? 0;
}
function short(text, max = 1400) { return String(text || "").slice(0, max); }

async function chooseExtras() {
  const choices = extra.map(item => item.name);
  try {
    const response = await client.responses.create({ model, max_output_tokens: 800,
      input: `Date: ${isoDate}. Theme: ${themes[day]}. Select exactly FIVE distinct publications from this allowed list for diverse, relevant and international reporting: ${choices.join("; ")}. Respond ONLY with a JSON array of five exact publication names. No explanation.` });
    if (response.status !== "completed") throw new Error("Selection incomplete");
    const selected = JSON.parse(response.output_text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
    if (!Array.isArray(selected) || selected.length !== 5 || new Set(selected).size !== 5) throw new Error("Invalid selection");
    const mapped = selected.map(name => extra.find(item => item.name === name));
    if (mapped.some(item => !item)) throw new Error("Unknown publication");
    return mapped;
  } catch (error) {
    console.warn(`Supplemental source choice fallback: ${error.message}`);
    // Deterministic fallback preserves 12 searches if selection is unavailable.
    return [extra[0], extra[3], extra[5], extra[10], extra[12]];
  }
}

const researchNotes = new Map();
async function searchPublication(target) {
  const record = { publication: target.name, domains: target.domains,
    attempted_at: new Date().toISOString(), search_calls: 0,
    cited_urls: [], consulted_urls: [], matched_urls: [], evidence_urls: [],
    outcome: "search_or_access_problem", reason: "" };
  audit.search_targets.push(record);
  try {
    const query = `Use web_search to seek reporting, analysis or commentary originating from ${target.name} (${target.domains.join(", ")}) during the seven days up to ${isoDate}, relevant to ${themes[day]}. Search this publication explicitly; do not pretend to have accessed paywalled text. Briefly identify up to TWO actual dated items and what each item's identifiable author or publisher reports or argues. Where other outlets cite this publication's original reporting, clearly identify that indirect attribution and its source. Include item URLs when available. If no identifiable relevant item was found, say NO RELEVANT RESULTS. Do not manufacture articles, quotes or perspectives. Keep the answer brief: 150-250 words maximum.`;
    record.query = query;
    const response = await client.responses.create({
      model, tools: [{ type: "web_search" }],
      include: ["web_search_call.action.sources"],
      max_output_tokens: 4500,
      input: query
    });
    record.search_calls = sourceCount(response);
    record.cited_urls = citations(response);
    record.consulted_urls = consultedSources(response);
    record.evidence_urls = uniqueUrls([...record.cited_urls, ...record.consulted_urls]);
    record.matched_urls = record.evidence_urls.filter(url => domainMatches(url, target.domains));

    const text = (response.output_text || "").trim();
    if (record.search_calls < 1 || response.status !== "completed" || !text) {
      record.reason = `status=${response.status}; calls=${record.search_calls}; incomplete=${response.incomplete_details?.reason ?? "none"}`;
    } else if (/^NO RELEVANT RESULTS\s*[.!]?$/i.test(text)) {
      record.outcome = "no_relevant_results";
      record.reason = "Completed search explicitly reported no identifiable relevant item";
    } else if (record.evidence_urls.length === 0) {
      record.reason = "Narrative returned without a consulted or cited URL; attribution could not be checked";
    } else {
      // An indirect article can be evidence that somebody *attributed* a claim
      // to the target; it is not proof we independently read its original.
      record.outcome = "found";
      record.reason = record.matched_urls.length
        ? "Real returned sources include requested publisher domain"
        : "Real returned sources found, but publisher origin is indirect/unconfirmed";
      researchNotes.set(target.name, short(text, 4200));
    }
  } catch (error) {
    record.reason = short(error.message, 240);
  }
  await saveAudit();
  console.log(`${target.name}: ${record.outcome}, ${record.search_calls} search call(s), ${record.evidence_urls.length} returned URL(s), ${record.matched_urls.length} publisher-domain URL(s)`);
  return record;
}

try {
  const previous = (await readdir("scripts"))
    .filter(name => /-news\.txt$/.test(name) && name !== path.basename(outputFile)).slice(-6);
  const previousSummaries = [];
  for (const filename of previous) {
    const body = await readFile(path.join("scripts", filename), "utf8");
    previousSummaries.push(`${filename}: ${body.slice(0, 1000)}`);
  }

  const targets = day === "sunday" ? sunday : [...core, ...await chooseExtras()];
  audit.planned_targets = targets.map(item => item.name);
  await saveAudit();
  console.log(`Researching ${day} (${isoDate}): ${themes[day]}; ${targets.length} source targets`);

  // Batches of three balance API load and bounded execution time. Each source
  // is actually queried; a general model promise to search is not counted.
  for (let i = 0; i < targets.length; i += 3) {
    await Promise.all(targets.slice(i, i + 3).map(searchPublication));
  }
  const eligible = audit.search_targets.filter(item => item.outcome === "found");
  if (!eligible.length) throw new Error("No identifiable source-backed research was obtained; refusing to invent an episode.");

  // Supply actual returned URL references, not URLs hallucinated in prose.
  // Indirect reports must be described as indirect, not independently checked.
  const evidence = eligible.map(item => `SEARCH TARGET: ${item.publication}\nORIGIN STATUS: ${item.reason}\nURLS RETURNED BY SEARCH TOOL OR CITATIONS:\n${item.evidence_urls.join("\n")}\nSOURCE RESEARCH NOTES (unverified statements must NOT be used):\n${researchNotes.get(item.publication) || ""}`).join("\n\n");
  console.log(`Drafting narration using source records from ${eligible.length} searches.`);
  const draft = await client.responses.create({
    model, max_output_tokens: 10000,
    input: `Write today's single-narrator British-English news podcast. Date: ${isoDate}. Theme: ${themes[day]}.\n\nEDITORIAL PLAN:\n${editorialPlan}\n\nVERIFIED SEARCH RECORDS:\n${evidence}\n\nPREVIOUS EPISODES:\n${previousSummaries.join("\n\n") || "None"}\n\nIMPORTANT: We attempted ${targets.length} source searches. Missing or inaccessible individual publications are NOT grounds to refuse or pad the episode. Work only with the supported, relevant material above; each story or attributed argument must trace to identifiable journalism evidenced by one of the returned URLs. A publisher-domain URL is helpful but NOT required; if an article from a different outlet references original reporting, attribute it as a secondary account and do not claim direct access to the original. Citations and consulted URLs establish source existence, not automatic correctness of every claim: omit any unsupported details. Do not mistake source-search technical failures for evidence that publications have no coverage. Do not invent events, quotes, perspectives, counterarguments or corroboration. Two legitimate sides are fine; do not manufacture a third. A single well-supported conclusion is also fine. Explain uncertainty and distinguish interpretation from fact. Only refuse if the available verified evidence is insufficient for ANY honest news episode; if so, begin exactly INSUFFICIENT VERIFIED RESEARCH and briefly explain why. Never refuse just because a roster publication had no result. Name only publications actually relied upon in the opening. Follow the editorial day's format; for Sunday use the international roundup format, not the weekday six-part structure. Short is fine; no minimum duration or word count. Maximum 22 minutes and 3300 words. Return spoken narration only, without headings, markdown, URLs or citations.`
  });
  if (draft.status !== "completed" || !draft.output_text?.trim()) {
    throw new Error(`Narration incomplete (status=${draft.status}; reason=${draft.incomplete_details?.reason ?? "none"}).`);
  }
  const script = draft.output_text.trim().replace(/\r\n/g, "\n");
  if (script.includes("INSUFFICIENT VERIFIED RESEARCH")) {
    throw new Error(`No publishable evidence: ${short(script, 900)}`);
  }
  const words = script.split(/\s+/).filter(Boolean).length;
  if (words < 80 || words > 3300 || /https?:\/\/|www\.|\[\d+\]|【|\*\*|```/.test(script)) {
const problems = [];
if (words < 80) problems.push("too short");
if (words > 3300) problems.push("too long");
if (/https?:\/\/|www\./.test(script)) problems.push("URL present");
if (/\[\d+\]/.test(script)) problems.push("numbered citation present");
if (/【/.test(script)) problems.push("citation marker present");
if (/\*\*/.test(script)) problems.push("Markdown bold present");
if (/```/.test(script)) problems.push("code fence present");

throw new Error(
  `Narration validation failed (${words} words): ${problems.join(", ")}`
);  }
  await writeFile(outputFile, script + "\n", { encoding: "utf8", flag: "wx" });
  audit.status = "script_created";
  audit.script_file = outputFile;
  audit.words = words;
  await saveAudit();
  console.log(`Created ${outputFile} (${words} words).`);
} catch (error) {
  audit.status = "failed";
  audit.failure = short(error.message, 1000);
  await saveAudit();
  console.error(`Daily generation stopped: ${error.message}`);
  process.exitCode = 1;
}
