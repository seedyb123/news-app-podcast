
# News App — Weekly Editorial Plan & Script Generation Principles

Version: 1.1
Updated: 29 October 2026
Automation additions: 29 October 2026

## Purpose

Produce a personalised, evidence-led news podcast that explains important developments, presents competing interpretations fairly, draws on politically and geographically diverse journalism, and discovers overlooked international stories.

Editorial value determines episode length. Never add material merely to fill time.

Use British English and a single, natural-sounding narrator.

## Weekly schedule

Monday: World & Geopolitics
Tuesday: Business & Economics
Wednesday: Technology & AI
Thursday: Work, Society & Policy
Friday: Ideas & Long-form Analysis
Saturday: Culture, Science & Discovery
Sunday: Missed News: Around the World

## Monday–Saturday source policy

Research all seven mandatory publications:
- BBC
- CNN
- Financial Times
- The Guardian
- The Wall Street Journal
- The Economist
- Al Jazeera

Additionally select and research five relevant publications per episode, considering specialist knowledge, political diversity (including socialist and right-wing perspectives), geographical diversity, original reporting and editorial quality.

Consulted does not mean used. Name in the narration only publications actually relied upon. Record all consulted sources separately, identifying those used.

Never claim to have read an inaccessible article. Disclose paywall and access limitations.

## Monday–Saturday episode structure

1. Opening & Introduction — up to 2 minutes.
   Introduce the day's subject, summarise major developments and name every publication actually used.

2. Main Development — up to 5 minutes.
   Explain the most consequential verified development, its context and significance.

3. Arguments For & Against — up to 5 minutes.
   Explain substantive competing interpretations, distinguishing evidence from opinion. Avoid false balance.

4. Other Developments — up to 5 minutes.
   Cover other important developments in the day's subject.

5. Wider & Underreported Perspectives — up to 5 minutes.
   Include overlooked reporting and relevant international perspectives.

6. Summary & Media Bias Assessment — up to 2 minutes.
   Summarise the findings and assess differences in framing among sampled sources. Where supported, classify perspectives as supportive, critical, mixed or neutral. Do not generalise the sample to all media.

Maximum episode length: 22 minutes, not a target. Shorter is preferable when justified by the material.

## Sunday — Missed News: Around the World

Research important developments from the preceding seven days across this pool of 17 G20 countries:

Argentina, Brazil, Canada, Mexico,
France, Germany, Italy, Russia,
China, India, Indonesia, Japan, South Korea,
Saudi Arabia, Türkiye, South Africa, Australia.

The European Union and African Union are not additional countries.

Do not use the seven mandatory Monday–Saturday publications for Sunday research.

Instead consult original reporting from local, national and regional publications based in the countries above. Select a politically and geographically varied range of credible sources.

Research all 17 countries as the discovery pool, but do not force one story per country into the episode.

Prioritise consequential, interesting and underreported developments from multiple countries and regions, across any subject.

Compare candidate stories with the preceding six episodes. Avoid repetition unless there is a materially different local consequence, manifestation or interpretation.

Sunday structure:
1. Brief introduction and sources used.
2. Concise stories organised by region or subject where useful.
3. Further underreported discoveries.
4. Closing summary.

Sunday is informative rather than debate-led. Do not manufacture opposing arguments for every story.

## Research and verification

Default reporting window: preceding seven days.

Record article titles, publications, dates and URLs.

Verify consequential facts using independent reporting or primary evidence where possible.

Distinguish confirmed facts, allegations, forecasts, opinions and editorial interpretations.

Do not count syndicated versions of the same report as independent corroboration.

Disclose missing evidence and source access limitations.

Do not invent facts, reporting, quotations, publication dates or references.

If adequate research or verification is unavailable, fail the episode rather than publish unreliable narration.

## Required outputs

Produce five separate outputs:

1. Research findings with developments, evidence, references and publication dates.
2. Source assessment documenting consultations, sources actually used, editorial framing and possible bias.
3. Complete single-presenter spoken narration, saved as a UTF-8 text file.
4. Markdown show notes with source titles, publication dates and URLs.
5. Production estimates: word count, estimated narration duration and ElevenLabs character count.

Spoken narration must contain no URLs, Markdown, citation markers or production instructions.

Narration filename:
dayname-ddmmyy-news.txt

Use the Europe/London date and correct daily theme.

## Automated production rules

Run at most once per Europe/London calendar day.

Do not regenerate or publish a second episode for the same date.

After research, verification and script validation, automatically generate ElevenLabs audio without manual approval.

Respect ElevenLabs credit limits and OpenAI API budget controls.

Do not automatically retry the full workflow after failure.

Only publish after successful research validation and audio generation.

Maintain a seven-day retention window for published episodes.

Keep research, source assessments, show notes and narration separately.

Support immediate disabling of the daily automation.

## Guiding principle

Prioritise accuracy, relevance, intellectual curiosity, diversity of perspectives, international coverage and efficient resource use.

