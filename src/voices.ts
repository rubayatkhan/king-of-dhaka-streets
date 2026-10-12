// Street voice lines. Each plays the family's recording when one exists, else an AI placeholder, else only its caption.
export type District = 'bazaar' | 'riverfront' | 'boulevard';
export type VoiceSource = 'family' | 'ai' | 'caption';
export interface VoiceLine {
  id: string; bangla: string; roman: string; caption: string; direction: string;
  /** Lines tied to one district are decoded only when a ride reaches it. */
  district?: District;
  /** Reactions answer something the rider did, so they skip the spacing between street calls. */
  reaction?: boolean;
  /** Minimum seconds between two plays of this line. */
  cooldown?: number;
}

export const VOICE_LINES: readonly VoiceLine[] = [
  { id: 'bus-helper-plastic', bangla: 'ওস্তাদ, বামে প্লাস্টিক!', roman: 'Ostad, baame plastic!', caption: 'Boss, something small on the left!', direction: 'A bus helper hanging off the door, warning his driver over the traffic. Slap the side of a table twice first (thak-thak), then shout.' },
  { id: 'bus-route-gulistan', bangla: 'গুলিস্তান! গুলিস্তান!', roman: 'Gulistan! Gulistan!', caption: 'Gulistan! Gulistan!', direction: 'A bus helper calling the route, fast and sing-song, as if leaning out of the door.' },
  { id: 'bus-route-motijheel', bangla: 'মতিঝিল! মতিঝিল! উঠেন, উঠেন!', roman: 'Motijheel! Motijheel! Uthen, uthen!', caption: 'Motijheel! Hop on, hop on!', direction: 'A bus helper hurrying passengers on board, waving them in.' },
  { id: 'bus-route-farmgate', bangla: 'ফার্মগেট! ফার্মগেট! খালি গাড়ি!', roman: 'Farmgate! Farmgate! Khali gari!', caption: 'Farmgate! Empty bus!', direction: 'A bus helper bragging that there are seats left, loud and cheerful.' },
  { id: 'rickshaw-mama', bangla: 'মামা, যাবেন?', roman: 'Mama, jaben?', caption: 'Uncle, need a ride?', direction: 'A rickshaw-puller asking a passer-by, friendly and a little tired.' },
  { id: 'tea-vendor', bangla: 'এই, চা! গরম চা! এক কাপ নিয়ে যান!', roman: 'Ei, cha! Gorom cha! Ek kap niye jan!', caption: 'Hot tea, fresh from the kettle!', direction: 'A tea seller at a street stall, calling out over the clink of glasses.', district: 'bazaar' },
  { id: 'badam-seller', bangla: 'বাদাম! বাদাম! গরম বাদাম!', roman: 'Badam! Badam! Gorom badam!', caption: 'Peanuts! Hot roasted peanuts!', direction: 'A peanut seller walking with a basket, a long call that rises at the end.', district: 'bazaar' },
  { id: 'launch-caller', bangla: 'সদরঘাট! সদরঘাট! লঞ্চ ছাড়বে, তাড়াতাড়ি আসেন!', roman: 'Sadarghat! Sadarghat! Launch charbe, taratari ashen!', caption: 'Sadarghat! The launch is leaving, hurry!', direction: 'A man at the river terminal shouting that the ferry is about to leave, urgent.', district: 'riverfront' },
  { id: 'boatman-nouka', bangla: 'নৌকা! নৌকা! পার হবেন?', roman: 'Nouka! Nouka! Par hoben?', caption: 'Boat! Boat! Crossing over?', direction: 'A boatman calling from the river steps, relaxed and drawn out.', district: 'riverfront' },
  { id: 'vegetable-vendor', bangla: 'তাজা সবজি! লাউ নেন, টমেটো নেন!', roman: 'Taja shobji! Lau nen, tomato nen!', caption: 'Fresh vegetables! Gourds, tomatoes!', direction: 'A vegetable seller at the wholesale market, brisk and loud.', district: 'boulevard' },
  { id: 'auction-caller', bangla: 'একশো! একশো দশ! আর কে?', roman: 'Eksho! Eksho dosh! Ar ke?', caption: 'A hundred! A hundred and ten! Anyone else?', direction: 'A wholesale auctioneer taking bids, quick-fire and excited.', district: 'boulevard' },
  { id: 'easy-brother', bangla: 'আস্তে ভাই, একটু জায়গা দেন!', roman: 'Aste bhai, ektu jayga den!', caption: 'Easy, brother, give a little room!', direction: 'Someone you just bumped, annoyed but not angry.', reaction: true, cooldown: 6 },
  { id: 'cha-ah', bangla: 'আহ্!', roman: 'Aah!', caption: 'Aah!', direction: 'One satisfied sigh after a sip of hot sweet tea.', reaction: true, cooldown: 3 },
  { id: 'pothole-uff', bangla: 'উফ!', roman: 'Uff!', caption: 'Oof!', direction: 'A short grunt as the wheel drops into a pothole.', reaction: true, cooldown: 3 },
  { id: 'stomach-gurgur', bangla: 'পেট গুড়গুড়!', roman: 'Pet gurgur!', caption: 'Tummy trouble!', direction: 'Funny and worried, holding your tummy, the second word wobbling.', reaction: true, cooldown: 6 },
  { id: 'near-miss-banchlam', bangla: 'বাঁচলাম!', roman: 'Banchlam!', caption: 'Phew, made it!', direction: 'Relieved and laughing after just squeezing past a bus.', reaction: true, cooldown: 12 },
  { id: 'crowd-king', bangla: 'ঢাকার রাজা!', roman: 'Dhakar raja!', caption: 'King of Dhaka!', direction: 'Everyone in the family shouting together, like a crowd cheering a champion.', reaction: true },
];

export interface ManifestEntry { family?: boolean; ai?: boolean; credit?: string }
export type VoiceManifest = Record<string, ManifestEntry>;
export const FAMILY_CREDIT_DEFAULT = 'Family voice';
const known = new Set(VOICE_LINES.map(l => l.id));

export function lineById(id: string): VoiceLine | undefined { return VOICE_LINES.find(l => l.id === id); }

export function sanitizeManifest(raw: unknown): VoiceManifest {
  const out: VoiceManifest = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(id) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>, entry: ManifestEntry = {};
    if (v.family === true) entry.family = true;
    if (v.ai === true) entry.ai = true;
    if (typeof v.credit === 'string' && v.credit.trim()) entry.credit = v.credit.trim().slice(0, 40);
    out[id] = entry;
  }
  return out;
}

export function voiceSource(id: string, manifest: VoiceManifest): VoiceSource {
  const entry = manifest[id];
  return entry?.family ? 'family' : entry?.ai ? 'ai' : 'caption';
}

export function voiceUrl(base: string, id: string, source: 'family' | 'ai'): string { return `${base}audio/voices/${source}/${id}.mp3`; }

/** The lines heard in one district, or with no argument the lines heard everywhere. */
export function linesFor(district?: District): VoiceLine[] { return VOICE_LINES.filter(l => l.district === district); }

export function familyCredits(manifest: VoiceManifest): string[] {
  return [...new Set(Object.values(manifest).filter(e => e.family).map(e => e.credit ?? FAMILY_CREDIT_DEFAULT))];
}
