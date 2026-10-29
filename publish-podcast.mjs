
import {
  readFile,
  writeFile,
  copyFile,
  stat,
  unlink
} from "node:fs/promises";

import path from "node:path";

const BASE_URL =
  "https://seedyb123.github.io/news-app-podcast/";

const MAX_EPISODES = 7;
const dryRun = process.argv.includes("--dry-run");

const themes = {
  monday: "World & Geopolitics",
  tuesday: "Business & Economics",
  wednesday: "Technology & AI",
  thursday: "Work, Society & Policy",
  friday: "Ideas & Long-form Analysis",
  saturday: "Culture, Science & Discovery",
  sunday: "Missed News: Around the World"
};

const today = new Date();

const dateParts = Object.fromEntries(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  })
    .formatToParts(today)
    .filter(p => p.type !== "literal")
    .map(p => [p.type, p.value])
);

const day = dateParts.weekday.toLowerCase();

const dateCode =
  dateParts.day +
  dateParts.month +
  dateParts.year;

const filename = `${day}-${dateCode}-news.mp3`;
const source = path.join("audio", filename);
const destination = filename;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const audioInfo = await stat(source);

if (!audioInfo.isFile() || audioInfo.size === 0) {
  throw new Error("Completed MP3 not found.");
}

const feed = await readFile("feed.xml", "utf8");

if (!feed.includes("</channel>")) {
  throw new Error("Podcast RSS feed is invalid.");
}

const episodeId = `news-app-${day}-${dateCode}`;

if (feed.includes(`<guid isPermaLink="false">${episodeId}</guid>`)) {
  throw new Error(
    "Today's episode has already been published."
  );
}

const episodeTitle =
  `${dateParts.weekday} — ${themes[day]}`;

const publicationDate = today.toUTCString();

const newItem = `
    <item>
      <title>${escapeXml(episodeTitle)}</title>
      <description>${escapeXml(
        `Daily news and analysis: ${themes[day]}.`
      )}</description>
      <pubDate>${publicationDate}</pubDate>
      <guid isPermaLink="false">${episodeId}</guid>
      <enclosure
        url="${BASE_URL}${filename}"
        length="${audioInfo.size}"
        type="audio/mpeg"/>
      <itunes:episodeType>full</itunes:episodeType>
    </item>`;

const existingItems =
  feed.match(/<item>[\s\S]*?<\/item>/g) || [];

const retainedItems = [
  newItem,
  ...existingItems
].slice(0, MAX_EPISODES);

const removedItems =
  existingItems.slice(MAX_EPISODES - 1);

const oldFiles = removedItems
  .map(item => {
    const match = item.match(
      /<enclosure[^>]*url="([^"]+)"/
    );

    if (!match) return null;

    const url = new URL(
      match[1].replace(/&amp;/g, "&")
    );

    const name = path.basename(url.pathname);

    return /^[a-z]+-\d{6}-news\.mp3$/.test(name)
      ? name
      : null;
  })
  .filter(Boolean);

const updatedFeed = feed
  .replace(/<item>[\s\S]*?<\/item>\s*/g, "")
  .replace(
    "</channel>",
    `${retainedItems.join("\n")}\n  </channel>`
  );

if (dryRun) {
  console.log("DRY RUN — no files changed.");
  console.log("New episode:", filename);
  console.log("MP3 size:", audioInfo.size);
  console.log("Episodes retained:", retainedItems.length);
  console.log("Old MP3s to remove:", oldFiles);
  process.exit(0);
}

await copyFile(source, destination);
await writeFile("feed.xml", updatedFeed, "utf8");

for (const oldFile of oldFiles) {
  if (oldFile !== filename) {
    try {
      await unlink(oldFile);
      console.log("Removed:", oldFile);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

console.log("Published:", filename);
console.log("RSS feed updated.");
console.log(
  `Episodes retained: ${retainedItems.length}`
);

