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

const editorialPlan = (await readFile("editorial-plan.md", "utf8")) + "\n\n" + (await readFile("source-policy.md", "utf8"));
await Promise.all([mkdir("scripts", { recursive: true }), mkdir(".news-runs", { recursive: true }), mkdir("source-logs", { recursive: true })]);
const audit = { date: isoDate, theme: themes[day], generated_at: new Date().toISOString(),
  status: "started", search_targets: [], totals: {}, failure: null,
  note: "Zero results means no cited URL on the target publication's domain was returned; it does not prove the publication published nothing." };
async function saveAudit() {
  audit.updated_at = new Date().toISOString();
  audit.totals = {
    targets: audit.search_targets.length,
    searched: audit.search_targets.filter(x => x.search_calls > 0).length,
    no_relevant_results: audit.search_targets.filter(x => x.outcome === "no_relevant_results").length,
    found: audit.search_targets.filter(x => x.outcome === "found").length,
    search_or_access_problem: audit.search_targets.filter(x => x.outcome === "search_or_access_problem").length
  };
  await writeFile(logFile, JSON.stringify(audit, null, 2) + "\n", "utf8");
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

function citations(response) {
  return [...new Set((response.output || [])
    .filter(item => item.type === "message")
    .flatMap(item => item.content || [])
    .flatMap(item => item.annotations || [])
    .filter(item => item.type === "url_citation" && typeof item.url === "string")
    .map(item => item.url))];
}
function domainMatches(url, domains) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
  } catch { return false; }
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
    cited_urls: [], matched_urls: [], outcome: "search_or_access_problem", reason: "" };
  audit.search_targets.push(record);
  try {
    const query = `You MUST use web_search to search reporting published by ${target.name} on ${target.domains.join(", ")} in the seven days up to ${isoDate}. Theme: ${themes[day]}. Search specifically this publication; don't substitute another outlet. Identify up to three consequential, verifiable relevant stories with article URLs, dates, and clearly attributed facts. When there are none, say NO RELEVANT RESULTS. Do not infer or invent any coverage. Do not claim access to paywalled text. Distinguish fact from commentary. Keep the research compact.`;
    record.query = query;
    const response = await client.responses.create({
      model, tools: [{ type: "web_search" }], max_output_tokens: 1700,
      input: query
    });
    record.search_calls = sourceCount(response);
    record.cited_urls = citations(response);
    record.matched_urls = record.cited_urls.filter(url => domainMatches(url, target.domains));
    if (response.status !== "completed" || !response.output_text?.trim() || record.search_calls < 1) {
      record.reason = `status=${response.status}; calls=${record.search_calls}; incomplete=${response.incomplete_details?.reason ?? "none"}`;
    } else if (!record.matched_urls.length) {
      record.outcome = "no_relevant_results";
      record.reason = "No cited URLs from the requested publisher domain; coverage or access may still exist";
    } else {
      record.outcome = "found";
      record.reason = "At least one publisher-domain citation returned";
    }
    researchNotes.set(target.name, short(response.output_text, 4200));
  } catch (error) {
    record.reason = short(error.message, 240);
  }
  await saveAudit();
  console.log(`${target.name}: ${record.outcome}, ${record.search_calls} search call(s), ${record.matched_urls.length} publisher URL(s)`);
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
  const verified = audit.search_targets.filter(item => item.outcome === "found");
  if (!verified.length) throw new Error("No publisher-domain source citations were verified; refusing to invent an episode.");

  // Only source results containing publisher-domain citations enter narration.
  const evidence = verified.map(item => `PUBLICATION: ${item.publication}\nVERIFIED PUBLISHER URLs:\n${item.matched_urls.join("\n")}\nRESEARCH SUMMARY (claims must be checked against listed URLs):\n${researchNotes.get(item.publication) || ""}`).join("\n\n");
  console.log(`Drafting narration using ${verified.length} publications with matched citations.`);
  const draft = await client.responses.create({
    model, max_output_tokens: 10000,
    input: `Write today's single-narrator British-English news podcast. Date: ${isoDate}. Theme: ${themes[day]}.\n\nEDITORIAL PLAN:\n${editorialPlan}\n\nVERIFIED SEARCH RECORDS:\n${evidence}\n\nPREVIOUS EPISODES:\n${previousSummaries.join("\n\n") || "None"}\n\nIMPORTANT: We attempted ${targets.length} source searches. Missing or inaccessible individual publications are NOT grounds to refuse or pad the episode. Work only with the supported, relevant material above; each factual story or attributed argument must connect to a listed publisher-domain URL. Do not invent events, quotes, perspectives, counterarguments or corroboration. Two legitimate sides are fine; do not manufacture a third. A single well-supported conclusion is also fine. Explain uncertainty and distinguish interpretation from fact. Only refuse if the available verified evidence is insufficient for ANY honest news episode; if so, begin exactly INSUFFICIENT VERIFIED RESEARCH and briefly explain why. Never refuse just because a roster publication had no result. Name only publications actually relied upon in the opening. Follow the editorial day's format; for Sunday use the international roundup format, not the weekday six-part structure. Short is fine; no minimum duration or word count. Maximum 22 minutes and 3300 words. Return spoken narration only, without headings, markdown, URLs or citations.`
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
    throw new Error(`Narration validation failed (${words} words).`);
  }
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
