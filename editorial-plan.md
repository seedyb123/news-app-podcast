# News App — Editorial & Production Principles

**Version:** 1.4
**Updated:** 30 October 2026
**Purpose:** Single authoritative specification for research, script generation and automated publication.

## 1. Editorial principles

Produce an evidence-led news podcast in British English, narrated by a single presenter.

Prioritise accuracy, relevance, diverse perspectives, international coverage and intellectual curiosity.

Never invent facts, events, quotations, statistics, references or arguments. Distinguish reporting, opinion, allegations, forecasts and interpretation.

Present competing perspectives only where supported by evidence. Avoid artificial balance.

Episode length is determined by substantive content, with a target of 20 minutes, with a +/- 5mins. However, this is target and guidance, there is no minimum word count.

## 2. Weekly schedule

| Day | Theme |
|---|---|
| Monday | World & Geopolitics |
| Tuesday | Business & Economics |
| Wednesday | Technology & AI |
| Thursday | Culture,Society & Work |
| Friday | Ideas & Long-form Analysis |
| Saturday | Science & Discovery |
| Sunday | Missed News: Around the World |

**Research window:** Preceding seven days.

## 3. Source selection

### Monday–Saturday

Attempt searches across these principle seven publications:

BBC, CNN, Financial Times, The Guardian, The Wall Street Journal, The Economist and Al Jazeera.

Additionally select five distinct publications relevant to the theme, prioritising specialist expertise, original reporting, political diversity and international perspectives.

**Target: 12 publication-level search attempts.**

### Sunday

Sunday is a global news roundup rather than a thematic debate.

Research local and national reporting across the **G20 countries excluding the US and UK**:

Argentina, Australia, Brazil, Canada, China, France, Germany, India, Indonesia, Italy, Japan, Mexico, Russia, Saudi Arabia, South Africa, South Korea and Türkiye.

Do not consult the seven fixed Monday–Saturday publications.

Research all 17 countries, but select only genuinely significant stories. Compare selections with the previous six episodes and avoid repetition unless there is a materially different local perspective or consequence.

## 4. Episode structure

### Monday–Saturday

| Section | Guiding duration |
|---|---|
| Opening, headlines and sources used | 2 minutes |
| Main development | 5 minutes |
| Evidence-based competing arguments | 5 minutes |
| Other developments | 5 minutes |
| Wider and underreported perspectives | 5 minutes |
| Summary and media framing assessment | 2 minutes |

Assess sources where evidence supports it and outline how much of the media landscape is in support of one side of a debate vs the other.

### Sunday

Use a flexible news-roundup structure:

1. Introduction and sources used.
2. Concise international stories, grouped where useful.
3. Additional underreported developments.
4. Closing summary.

Prioritise information dissemination over debate.

## 5. Research verification

Aspiration: each substantive claim should be supported by identifiable reporting or primary evidence.

Record article titles, outlet, publication dates and real URLs wherever available.

It is more important that there is an attempt to reference which media outlet supports an argument than hard rules obsessing about the URL.

A source may be usable without a publisher-domain citation annotation.

An LLM assertion alone is not proof that an article exists.

Distinguish direct reporting from secondary references. Do not treat syndicated copies as independent corroboration or claim to have read inaccessible articles.

## 6. Failure rules

Missing search results, paywalls and access limitations do not automatically fail an episode. Continue with verified material and produce a shorter episode where appropriate.

Fail only if no defensible verified story exists or technical problems prevent production.

If no sources (defined as media outlet) can be sited for any argument, then the research should be deemed as failing. This should safeguard against LLM hallucination of arguments.

An unsuccessful search or inaccessible article does not prevent publication.

## 7. Source audit

For every research attempt, create:

`source-logs/DDMMYY.json`

Record each publication's name, domains, search query, search-call count, consulted URLs, cited URLs and outcome:

- `found` — identifiable relevant reporting, including clearly identified secondary references.
- `no_relevant_results` — completed search explicitly returned no identifiable relevant material.
- `search_or_access_problem` — incomplete search, tool failure or insufficient information to verify results.

Track publisher-domain matches separately. Zero domain matches alone do not establish that no relevant results exist.

Persist source logs to GitHub even if episode production fails. Evaluate publication performance using aggregated results across multiple days.

## 8. Required outputs

Generate five separate outputs:

1. Research findings with evidence and references.
2. Source assessment covering consultations, material used, perspectives and potential bias.
3. Complete single-presenter narration as UTF-8 plain text.
4. Markdown show notes with article titles, dates and links.
5. Word count, estimated narration duration and ElevenLabs character count.

Name all publications actually relied upon in the narration introduction.

The narration file must contain spoken words only: no Markdown, URLs or production instructions.

**Filename:** `dayname-ddmmyy-news.txt`

Use the Europe/London calendar date and corresponding theme.

## 9. Automation and publication

- Run no more than once per Europe/London calendar day.
- Never regenerate or publish a second episode for the same date.
- Validate research and narration before audio generation.
- Automatically generate ElevenLabs audio after successful validation, without additional approval.
- Respect ElevenLabs credits and OpenAI API budgets.
- Do not automatically retry the complete workflow after failure.
- Publish audio script only after successful research validation and audio generation.
- Retain published episodes for seven days.
- Keep narration, research, source assessments and show notes separate.
- Support immediate disabling of the daily automation.

## 10. Governing rule

**Search broadly. Verify carefully. Publish only where a position exists or news has been reported.**

Do not sacrifice factual integrity to meet a source quota, achieve political balance or extend episode duration.

The argument does not need to be even, it should convey where the majority of positions fall on one side of the argument, which should be articulated in the ‘Summary and media framing assessment’ Monday-Saturday.