import { toFile } from 'openai';
import { detectLang } from '../../lib/lang.ts';
import { audioDurationSeconds } from '../../lib/audio-duration.ts';
import { redact } from '../../lib/redact.ts';
import { bad, readCapped, upstreamError } from '../../server/http.ts';
import { openai, TRANSCRIBE_MODEL } from '../../server/openai.ts';
import { check, tooMany } from '../../server/ratelimit.ts';

export const maxDuration = 60;

// 30 seconds of opus or AAC is well under this; anything bigger is not a 30 second clip.
const MAX_AUDIO = 1_000_000;
const TYPES: Record<string, string> = { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

export async function POST(req: Request) {
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const ext = TYPES[type];
  if (!ext) return bad('Send the recording as audio/webm, audio/mp4, audio/ogg, audio/mpeg or audio/wav.', 415);

  const read = await readCapped(req, MAX_AUDIO);
  if (!read.ok) return read.reason === 'too_large' ? bad('Recordings are capped at 30 seconds.', 413) : bad('Could not read the recording.');
  if (read.bytes.byteLength < 1000) return bad('The recording is empty. Hold the mic and speak.');

  // Billing follows audio length, and a low bitrate fits minutes into 1MB, so bound the length too.
  const seconds = audioDurationSeconds(read.bytes);
  if (seconds === null) return bad('Could not read the length of this recording. Try again.', 415);
  if (seconds > 35) return bad('Recordings are capped at 30 seconds.', 413);

  const gate = check(req, 'transcribe');
  if (!gate.ok) return tooMany(gate.retryAfter, 'voice questions');

  try {
    const file = await toFile(read.bytes, `question.${ext}`, { type });
    const res = await openai().audio.transcriptions.create({
      model: TRANSCRIBE_MODEL,
      file,
      prompt: 'A question about Indian government services such as Aadhaar, PAN, passport, ITR, GST, Udyam, driving licence, PM-KISAN, Ayushman Bharat, DigiLocker, CPGRAMS. May be in English, Hindi or Hinglish.',
    });
    const { text, removed } = redact(res.text.trim().slice(0, 500));
    return Response.json({ text, removed, lang: detectLang(text) });
  } catch (err) {
    return upstreamError(err);
  }
}
