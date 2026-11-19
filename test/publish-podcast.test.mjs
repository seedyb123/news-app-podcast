import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Run the real publisher against isolated files. No provider, Git or live-feed
// operation is invoked. The clock is mocked in the test process only.
const publisher = fileURLToPath(new URL('../publish-podcast.mjs', import.meta.url));
const todayFile = 'thursday-191126-news.mp3';
const todayGuid = 'news-app-thursday-191126';
const completedAudio = Buffer.from([0x49, 0x44, 0x33, 0, 1, 2]);
const oldAudio = Buffer.from('existing audio fixture');

function daily(number) {
  const filename = `monday-${String(number).padStart(2, '0')}1026-news.mp3`;
  return {
    filename,
    xml: `<item><title>Daily ${number}</title><guid isPermaLink="false">news-app-daily-${number}</guid><enclosure url="https://seedyb123.github.io/news-app-podcast/${filename}"/></item>`,
  };
}

function research(number) {
  const filename = `research-${number}.mp3`;
  return {
    filename,
    xml: `<item><title>Research ${number}</title><description>Original research notes &amp; references.</description><guid isPermaLink="false">escape-the-cave-research-v2.2:research-${number}</guid><enclosure url="https://seedyb123.github.io/news-app-podcast/${filename}"/></item>`,
  };
}

async function fixture(t, entries, { source = completedAudio, feed, missing = [] } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'etc-v1-publisher-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'audio'));
  if (source !== null) await writeFile(join(directory, 'audio', todayFile), source);
  for (const entry of entries) {
    if (!missing.includes(entry.filename)) await writeFile(join(directory, entry.filename), oldAudio);
  }
  const original = feed ?? `<?xml version="1.0"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Escape the Cave</title>${entries.map(entry => entry.xml).join('\n')}</channel></rss>`;
  await writeFile(join(directory, 'feed.xml'), original);
  const clock = join(directory, 'clock.mjs');
  await writeFile(clock, `const NativeDate = Date;
globalThis.Date = class extends NativeDate {
  constructor(...args) { super(...(args.length ? args : [1795089600000])); }
  static now() { return 1795089600000; }
};\n`);
  return {
    original,
    run: (...args) => spawnSync(process.execPath, ['--import', clock, publisher, ...args], {
      cwd: directory, encoding: 'utf8', env: { PATH: process.env.PATH, TZ: 'UTC' },
    }),
    feed: () => readFile(join(directory, 'feed.xml'), 'utf8'),
    file: (name) => readFile(join(directory, name)),
  };
}

const items = feed => feed.match(/<item>[\s\S]*?<\/item>/g) || [];
const researchItems = feed => items(feed).filter(item => item.includes('escape-the-cave-research-v2.2:'));
const dailyItems = feed => items(feed).filter(item => !item.includes('escape-the-cave-research-v2.2:'));

test('Daily-only publication still retains seven Daily episodes and removes only expired Daily audio', async t => {
  const entries = Array.from({ length: 9 }, (_, index) => daily(index + 1));
  const app = await fixture(t, entries);
  const result = app.run();
  assert.equal(result.status, 0, result.stderr);
  const feed = await app.feed();
  assert.equal(dailyItems(feed).length, 7);
  assert.match(feed, /<title>Thursday — Work, Society &amp; Policy<\/title>/);
  assert.match(feed, /<pubDate>Thu, 19 Nov 2026 12:00:00 GMT<\/pubDate>/);
  assert.match(feed, /length="6"/);
  assert.match(feed, new RegExp(todayGuid));
  assert.deepEqual(await app.file(todayFile), completedAudio);
  for (const entry of entries.slice(0, 6)) {
    assert.ok(feed.includes(entry.xml));
    assert.deepEqual(await app.file(entry.filename), oldAudio);
  }
  for (const entry of entries.slice(6)) {
    assert.ok(!feed.includes(entry.xml));
    await assert.rejects(app.file(entry.filename), { code: 'ENOENT' });
  }
});

test('interleaved Research episodes do not displace any of the seven Daily slots', async t => {
  const days = Array.from({ length: 7 }, (_, index) => daily(index + 1));
  const studies = [research(1), research(2), research(3)];
  const app = await fixture(t, [studies[0], ...days.slice(0, 3), studies[1], ...days.slice(3), studies[2]]);
  const result = app.run();
  assert.equal(result.status, 0, result.stderr);
  const feed = await app.feed();
  assert.equal(dailyItems(feed).length, 7);
  assert.equal(researchItems(feed).length, 3);
  assert.equal(items(feed).length, 10);
  for (const entry of studies) {
    assert.ok(feed.includes(entry.xml));
    assert.deepEqual(await app.file(entry.filename), oldAudio);
  }
  assert.ok(!feed.includes(days[6].xml));
  await assert.rejects(app.file(days[6].filename), { code: 'ENOENT' });
});

test('Research history above seven entries is retained without a Research retention limit', async t => {
  const studies = Array.from({ length: 20 }, (_, index) => research(index + 1));
  const app = await fixture(t, studies);
  const result = app.run();
  assert.equal(result.status, 0, result.stderr);
  const feed = await app.feed();
  assert.equal(researchItems(feed).length, 20);
  assert.equal(dailyItems(feed).length, 1);
  for (const entry of studies) {
    assert.ok(feed.includes(entry.xml));
    assert.deepEqual(await app.file(entry.filename), oldAudio);
  }
});

test('fewer than seven Daily episodes are all retained alongside Research', async t => {
  const entries = [daily(1), research(1), daily(2)];
  const app = await fixture(t, entries);
  assert.equal(app.run().status, 0);
  const feed = await app.feed();
  assert.equal(dailyItems(feed).length, 3);
  assert.equal(researchItems(feed).length, 1);
  for (const entry of entries) assert.ok(feed.includes(entry.xml));
});

test('an empty existing feed still accepts the new Daily episode', async t => {
  const app = await fixture(t, []);
  assert.equal(app.run().status, 0);
  assert.equal(items(await app.feed()).length, 1);
  assert.deepEqual(await app.file(todayFile), completedAudio);
});

test('the existing duplicate-Daily check still prevents feed or audio replacement', async t => {
  const duplicate = { filename: todayFile, xml: `<item><guid isPermaLink="false">${todayGuid}</guid></item>` };
  const app = await fixture(t, [duplicate, research(1)]);
  const result = app.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /already been published/);
  assert.equal(await app.feed(), app.original);
  assert.deepEqual(await app.file(todayFile), oldAudio);
});

test('dry run leaves the feed and all existing audio unchanged', async t => {
  const entries = [research(1), ...Array.from({ length: 8 }, (_, index) => daily(index + 1))];
  const app = await fixture(t, entries);
  const result = app.run('--dry-run');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DRY RUN/);
  assert.equal(await app.feed(), app.original);
  await assert.rejects(app.file(todayFile), { code: 'ENOENT' });
  for (const entry of entries) assert.deepEqual(await app.file(entry.filename), oldAudio);
});

test('invalid RSS still fails without changing the feed or publishing audio', async t => {
  const app = await fixture(t, [], { feed: '<rss><channel>broken' });
  const result = app.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /RSS feed is invalid/);
  assert.equal(await app.feed(), app.original);
  await assert.rejects(app.file(todayFile), { code: 'ENOENT' });
});

test('missing or empty completed audio still fails without changing the feed', async t => {
  for (const source of [null, Buffer.alloc(0)]) {
    const app = await fixture(t, [research(1)], { source });
    assert.notEqual(app.run().status, 0);
    assert.equal(await app.feed(), app.original);
    assert.deepEqual(await app.file('research-1.mp3'), oldAudio);
    await assert.rejects(app.file(todayFile), { code: 'ENOENT' });
  }
});

test('an already absent expired Daily audio file does not prevent publication', async t => {
  const entries = Array.from({ length: 7 }, (_, index) => daily(index + 1));
  const app = await fixture(t, entries, { missing: [entries[6].filename] });
  const result = app.run();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(dailyItems(await app.feed()).length, 7);
});
