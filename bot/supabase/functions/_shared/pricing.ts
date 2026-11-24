// Prix de vente XOF à partir du coût fournisseur et des marges du fournisseur.
export interface MarginSettings { usd_rate: number; margin_percent: number; margin_fixed: number }

const RATES_TO_XOF = { XOF: 1, EUR: 655.957 } as const;

export function sellPrice(cost: number, currency: "USD" | "XOF" | "EUR", s: MarginSettings): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  const rate = currency === "USD" ? Number(s.usd_rate) : RATES_TO_XOF[currency];
  const withMargin = cost * rate * (1 + Number(s.margin_percent) / 100) + Number(s.margin_fixed);
  // Arrondi supérieur aux 50 F : la marge n'est jamais rognée par l'arrondi.
  return Math.ceil(withMargin / 50) * 50;
}

// Rangement automatique des offres importées (modifiable ensuite dans la table products).
const CATEGORY_RULES: [string, RegExp][] = [
  ["🎬 Streaming", /netflix|prime video|disney|hbo|max\b|crunchyroll|canal|iptv|youtube|apple tv|paramount|shahid|osn/i],
  ["🎵 Musique", /spotify|deezer|apple music|tidal|soundcloud|audible/i],
  ["🤖 IA", /chatgpt|openai|gpt|claude|gemini|perplexity|midjourney|copilot|grok|elevenlabs|runway|higgsfield|manus|lovable|bolt|cursor|replit|gamma|leonardo|suno|heygen/i],
  ["🎨 Design & Vidéo", /canva|adobe|capcut|figma|envato|freepik|picsart|filmora/i],
  ["💼 Productivité", /office|microsoft|365|notion|grammarly|quillbot|zoom|google one|dropbox|scribd|linkedin|coursera|duolingo/i],
  ["🔒 VPN & Sécurité", /vpn|nord|express|surfshark|kaspersky|norton|bitdefender|avast|mcafee/i],
  ["🎮 Jeux", /xbox|playstation|psn|steam|game pass|nintendo|roblox|free fire|pubg|valorant|fortnite/i],
];
export function guessCategory(name: string): string {
  return CATEGORY_RULES.find(([, re]) => re.test(name))?.[0] ?? "📦 Autres";
}
