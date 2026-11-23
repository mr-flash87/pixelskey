// Shared by catalogue imports and the storefront; brand matching is independent of duration.
const brandImages: [RegExp, string][] = [
  [/\bautodesk\b/, "brand/autodesk.jpg"],
  [/\badobe\b/, "brand/adobe.jpg"],
  [/\btelegram\b/, "brand/telegram.jpg"],
  [/\bcoursera\b/, "brand/coursera.jpg"],
  [/\bduolingo\b/, "brand/duolingo.jpg"],
  [/\bexpress\s?vpn\b/, "brand/expressvpn.jpg"],
  [/\bheygen\b/, "brand/heygen.jpg"],
  [/\bilove\s?pdf\b/, "brand/ilovepdf.jpg"],
  [/\blinkedin\b/, "brand/linkedin.jpg"],
  [/\bmuse\s+ai\b/, "brand/muse.jpg"],
  [/\blovable\b/, "brand/lovable.jpg"],
  [/\b(?:chatgpt|gpt)\b/, "brand/chatgpt.jpg"],
  [/\bcanva\b/, "brand/canva.jpg"],
  [/\bcapcut\b/, "brand/capcut.jpg"],
  [/\breplit\b/, "brand/replit.jpg"],
  [/\bcursor\b/, "brand/cursor.jpg"],
  [/\bquillbot\b/, "brand/quillbot.jpg"],
  [/\bgemini\b/, "1cd377fc-1c6a-4b68-903d-9a44587f0544.jpeg"],
  [/\bwindows\b/, "eba655d1-e2aa-4da8-b71c-e493826ebc19.jpeg"],
  [/\b(?:microsoft|office)\b/, "brand/office.jpg"],
  [/\boutlook\b/, "brand/outlook.jpg"],
  [/\beleven(?:labs|reader|readers)?\b/, "brand/eleven.jpg"],
  [/\bnord(?:vpn)?\b/, "brand/nord.jpg"],
  [/\bprime\s+video\b/, "brand/prime.jpg"],
  [/\byoutube\b/, "brand/youtube.jpg"],
  [/\bavira\b/, "brand/avira.jpg"],
  [/\bbolt\b/, "brand/bolt.jpg"],
  [/\bemergent\b/, "brand/emergent.jpg"],
  [/\bfigma\b/, "brand/figma.jpg"],
  [/\bgamma\b/, "brand/gamma.jpg"],
  [/\bgranola\b/, "brand/granola.jpg"],
  [/\b(?:join\s+)?secret\b/, "brand/secret.jpg"],
  [/\bmiro\b/, "brand/miro.jpg"],
  [/\bnotion\b/, "brand/notion.jpg"],
  [/\bveo\b/, "brand/veo.jpg"],
  [/\bhiggsfield\b/, "brand/higgsfield.jpg"],
  [/\bmanus\b/, "brand/manus.jpg"],
  [/\brunway\b/, "brand/runway.jpg"],
  [/\bsupabase\b/, "brand/supabase.jpg"],
  [/(?:^|\s)x\s+premium\b/, "brand/x.jpg"],
];

export function brandImagePath(name: string, slug = ""): string | null {
  const text = `${name} ${slug}`.toLowerCase().replace(/[-_]/g, " ");
  return brandImages.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export function brandImageUrl(baseUrl: string, name: string, slug = ""): string | null {
  const path = brandImagePath(name, slug);
  return path ? `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${path}` : null;
}
