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

## Source-performance records

Write `source-logs/DDMMYY.json` every time the generator attempts research. Each publication's log records its name, domain, attempted query, observed web search call count, relevant publisher-domain citation URLs and one of:

- `found`: at least one cited URL matches the requested publisher's domain;
- `no_relevant_results`: the search completed but no publisher-domain citation was returned;
- `search_or_access_problem`: search was not completed, failed, or could not be verified.

The second status **does not prove the outlet published nothing**. Counts are conservative, observable search-result signals, not audits of everything published. Do not count citations from other outlets as results for a searched publication. Preserve logs in GitHub even if script generation fails, using a post-generation commit step that runs on failure.

Over time, aggregate publication-level attempts and the `no_relevant_results` rate. Evaluate performance over multiple episodes before changing the roster; investigate paywalls and search tool limitations before concluding a source is ineffective. Searching a source does not mean using or endorsing it in the published episode.

## Publication limits

Keep the existing 22-minute ceiling and script sanitisation. Remove the former arbitrary minimum of 350 spoken words; short, reliable episodes are welcome. Keep the single-narrator format and respective weekday/Sunday editorial structures. Do not publish a script with no verified supporting material.
