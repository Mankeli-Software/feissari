// feissariVoiceCache.ts
// In-memory cache for feissari name to voice mapping

const VOICES = [
  'speak1.ogg',
  'speak2.ogg',
  'speak3.ogg',
  'speak4.ogg',
  'speak5.ogg',
  'speak6.ogg',
  'speak7.ogg',
];

const feissariVoiceCache: Record<string, string> = {};

export function getVoiceForFeissari(name: string): string {
  if (!name) return VOICES[0];
  if (!feissariVoiceCache[name]) {
    // Pick a random voice from the list
    const randomVoice = VOICES[Math.floor(Math.random() * VOICES.length)];
    feissariVoiceCache[name] = randomVoice;
  }
  return feissariVoiceCache[name];
}

export function resetVoiceCache() {
  Object.keys(feissariVoiceCache).forEach(key => delete feissariVoiceCache[key]);
}
