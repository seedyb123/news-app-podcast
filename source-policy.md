# Escape the Cave — Source Search and Editorial Evidence Policy

Updated: 30 October 2026.

## Purpose

Search broadly; publish only defensible facts and attributed arguments. The breadth of searching is an input requirement, **not** a quota for the number of different positions presented in the episode.

## Search roster

- **Monday–Saturday:** attempt the seven fixed publications (BBC, CNN, Financial Times, The Guardian, The Wall Street Journal, The Economist, Al Jazeera), plus five additional distinct and relevant publications chosen for the topic. Twelve publication-level search attempts are the target, irrespective of the number of usable sources returned.
- **Sunday:** retain the original special rule: search original/local reporting across the 17-country G20 pool excluding the US and UK; do not use the seven fixed weekday publications. The pool does not impose a requirement to publish a story from each country.
- Wednesday and Thursday were examples, **not distinct editorial standards**. Apply the same evidence policy throughout the week.

## What a missing source means

A publication returning no relevant, identifiable results is not grounds to fail script production. Neither is an access problem or unavailable paywalled article. Continue using genuinely verified material from other sources; prefer a shorter episode to unsupported filler. Only refuse to publish if there is no defensible verified story, or technical failure prevents trustworthy production.

## Debate and factual integrity

Never invent news events, facts, quotations, statistics, publications, evidence, or arguments. Every substantive claim and attribution must be grounded in real reporting or primary evidence. If research supports two credible perspectives, present two. Do not invent further sides to achieve numerical balance. If the evidence strongly supports one conclusion, say so; avoid false equivalence. Attribute genuine disagreement accurately, including disagreements about values rather than facts. Distinguish published opinion from independently corroborated reporting.

## Source provenance and performance records

A genuine article or report from an identifiable publication can support an episode even if the OpenAI response did not attach a URL annotation from that publication's domain. The citation-annotation format is not an editorial eligibility rule. Whenever possible, retain real article URLs from the web search tool's consulted-source list and response citations. Do **not** accept the LLM's bare assertion that an article exists as proof. A consulted URL establishes a returned source, **not** that a complete paywalled article was read or that every claim in a summary is verified.

If a source at another outlet references the target publication's original reporting, distinguish that secondary reference from direct verification. Attribute arguments to their actual authors, and facts to the evidence available. Never fabricate a URL, article, publication date, quote, statistic, story, viewpoint or counterargument.

Write `source-logs/DDMMYY.json` every time the generator attempts research. Each publication's log includes name, domains, query, search call count, cited URLs, consulted URLs and one outcome:

- `found`: the completed search returned identifiable URLs and relevant reporting, including secondary references clearly labelled as such;
- `no_relevant_results`: the completed response explicitly reported no identifiable relevant material;
- `search_or_access_problem`: an incomplete request, tool failure, missing text, missing consulted/cited URLs, or other inability to verify the search result.

A zero publisher-domain match by itself **must never** be logged as `no_relevant_results`, or counted against a publication's effectiveness. Record domain matches separately as diagnostic information. Persist the audit to GitHub even if the episode later fails, and use aggregated multi-day evidence rather than isolated failures when considering roster changes.

## Publication limits

Keep the existing 22-minute ceiling and script sanitisation. Remove the former arbitrary minimum of 350 spoken words; short, reliable episodes are welcome. Keep the single-narrator format and respective weekday/Sunday editorial structures. Do not publish a script with no verified supporting material.
