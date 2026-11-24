import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const feed = await readFile(new URL('../feed.xml', import.meta.url), 'utf8');
const guid = 'escape-the-cave-research-v2.2:d8e758dc-728a-4bc6-848e-9fd1a5b19b18';
const weather = feed.match(/<item>[\s\S]*?<\/item>/g).find(item => item.includes(guid));
const sourceLinks = [
  'https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Tmean/date/Scotland.txt',
  'https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/Rainfall/date/Scotland.txt',
  'https://rmets.onlinelibrary.wiley.com/doi/10.1002/joc.70470',
  'https://www.metoffice.gov.uk/research/climate/maps-and-data/uk-climate-extremes',
  'https://www.ipcc.ch/report/ar6/syr/summary-for-policymakers/',
  'https://www.metoffice.gov.uk/binaries/content/assets/metofficegovuk/pdf/weather/learn-about/uk-past-events/interesting/2023/2023_08_storm_babet.pdf',
  'https://www.sepa.org.uk/water-scarcity/water-scarcity-seasonal-reports/autumn-water-situation-report-2025',
  'https://www.worldweatherattribution.org/autumn-and-winter-storms-over-uk-and-ireland-are-becoming-wetter-due-to-climate-change/',
  'https://www.mdpi.com/2072-4292/15/7/1944',
  'https://www.metoffice.gov.uk/pub/data/weather/uk/climate/datasets/AirFrost/date/Scotland.txt',
  'https://adaptation.scot/app/uploads/2025/08/low-res-6440-climate-projections-report-aug-25.pdf',
];

function xpath(expression) {
  const result = spawnSync('xmllint', ['--nonet', '--xpath', expression, '-'], { input: feed, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('valid RSS keeps the podcast name, URL and existing artwork with the revised channel author', () => {
  assert.equal(xpath('string(/rss/channel/title)'), 'Escape the Cave');
  assert.equal(xpath('string(/rss/channel/link)'), 'https://seedyb123.github.io/news-app-podcast/');
  const header = feed.slice(0, feed.indexOf('<item>'));
  assert.equal((header.match(/<itunes:author>Hixet Productions<\/itunes:author>/g) || []).length, 1);
  assert.ok(header.includes('<itunes:image href="https://seedyb123.github.io/news-app-podcast/escape-the-cave-cover-v2.jpg"/>'));
});

test('Weather in Scotland retains its title, publication date, GUID and original audio enclosure', () => {
  assert.ok(weather);
  assert.ok(weather.includes('<title>Weather in Scotland</title>'));
  assert.ok(weather.includes('<pubDate>Tue, 24 Nov 2026 10:55:45 GMT</pubDate>'));
  assert.ok(weather.includes(`<guid isPermaLink="false">${guid}</guid>`));
  assert.ok(weather.includes('<enclosure url="https://seedyb123.github.io/news-app-podcast/research-d8e758dc-728a-4bc6-848e-9fd1a5b19b18.mp3" length="4483073" type="audio/mpeg"/>'));
});

test('Weather description has one bold opening, substantive summary, separate headings and all original source hyperlinks', () => {
  const description = xpath('string(/rss/channel/item[title="Weather in Scotland"]/description)');
  assert.ok(description.startsWith('<p><strong>One-off briefing on how Scotland’s weather changed from 1926 to 2025</strong></p>\n\n<p>This five-minute scientific report'));
  assert.equal((description.match(/One-off briefing on/g) || []).length, 1);
  assert.ok(description.includes('<p><strong>Findings and method</strong></p>\n\n<p>'));
  assert.ok(description.includes('<p><strong>Sources</strong></p>\n\n<ol>'));
  assert.equal((description.match(/<li>/g) || []).length, 12);
  assert.doesNotMatch(description, /##|\*\*|\]\(/);
  for(const url of sourceLinks) assert.ok(description.includes(`href="${url}"`), url);
});
