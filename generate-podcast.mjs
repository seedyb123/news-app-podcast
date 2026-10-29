import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';

const args = process.argv.slice(2);
const input = args.find(arg => !arg.startsWith('--'));
const dryRun = args.includes('--dry-run');
const MAX_CHARS = 4000;
const VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // Existing test voice
const MODEL_ID = 'eleven_multilingual_v2';
const OUTPUT_FORMAT = 'mp3_44100_128';

if (!input) {
  console.error('Usage: node --env-file=.env.local generate-podcast.mjs scripts/news.txt [--dry-run]');
  process.exit(1);
}

// Split on paragraph boundaries first, then sentence boundaries, then words.
function splitText(text, limit) {
  const paragraphs = text.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  const units = [];
  for (const paragraph of paragraphs) {
    const sentences = paragraph.trim().match(/[^.!?]+(?:[.!?]+(?=\s|$)|$)/g) || [paragraph.trim()];
    for (const sentence of sentences) {
      if (!sentence.trim()) continue;
      if (sentence.length <= limit) {
        units.push(sentence.trim());
      } else {
        let partial = '';
        for (const word of sentence.trim().split(/\s+/)) {
          if (word.length > limit) throw new Error('An individual word exceeds the character limit.');
          if (partial && `${partial} ${word}`.length > limit) {
            units.push(partial);
            partial = word;
          } else {
            partial = partial ? `${partial} ${word}` : word;
          }
        }
        if (partial) units.push(partial);
      }
    }
  }
  const chunks = [];
  let current = '';
  for (const unit of units) {
    if (current && `${current} ${unit}`.length > limit) {
      chunks.push(current);
      current = unit;
    } else {
      current = current ? `${current} ${unit}` : unit;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

const text = (await readFile(input, 'utf8')).trim();
if (!text) throw new Error('The input script is empty.');
const chunks = splitText(text, MAX_CHARS);
const totalChars = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
console.log(`Script: ${input}`);
console.log(`Sections: ${chunks.length}; characters sent: ${totalChars}`);
chunks.forEach((chunk, i) => console.log(`  ${i + 1}: ${chunk.length} characters`));
if (dryRun) {
  console.log('Preview only — no ElevenLabs API calls or credits used.');
  process.exit(0);
}
if (!process.env.ELEVENLABS_API_KEY) throw new Error('Run with node --env-file=.env.local to load the ElevenLabs key.');
if (spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).error) {
  throw new Error('FFmpeg is required to combine audio. Install with: brew install ffmpeg');
}

const client = new ElevenLabsClient();
const base = path.basename(input, path.extname(input));
const fingerprint = createHash('sha256').update(JSON.stringify({ chunks, VOICE_ID, MODEL_ID, OUTPUT_FORMAT })).digest('hex').slice(0, 12);
const partsDir = path.join('audio', `${base}-parts-${fingerprint}`);
await mkdir(partsDir, { recursive: true });
const partFiles = [];
for (let i = 0; i < chunks.length; i++) {
  const partFile = path.join(partsDir, `part-${String(i + 1).padStart(3, '0')}.mp3`);
  partFiles.push(partFile);
  try {
    await access(partFile);
    console.log(`Using existing part ${i + 1}/${chunks.length}`);
    continue;
  } catch { /* Not generated yet */ }
  console.log(`Generating part ${i + 1}/${chunks.length}...`);
  const audio = await client.textToSpeech.convert(VOICE_ID, {
    text: chunks[i],
    modelId: MODEL_ID,
    outputFormat: OUTPUT_FORMAT,
    ...(i > 0 ? { previousText: chunks[i - 1].slice(-250) } : {}),
    ...(i < chunks.length - 1 ? { nextText: chunks[i + 1].slice(0, 250) } : {}),
  });
  const data = [];
  for await (const piece of audio) data.push(Buffer.from(piece));
  await writeFile(partFile, Buffer.concat(data));
}

// Concat-demuxer safely joins MP3 files without manual byte concatenation.
const listFile = path.join(partsDir, 'concat.txt');
await writeFile(listFile, partFiles.map(file => `file '${path.basename(file)}'`).join('\n') + '\n');
const output = path.join('audio', `${base}.mp3`);
const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', output], { stdio: 'inherit' });
if (result.error || result.status !== 0) throw new Error('FFmpeg could not assemble the MP3. Individual parts remain saved.');
console.log(`Podcast ready: ${output}`);
