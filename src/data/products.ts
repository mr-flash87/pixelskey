// Données de démonstration (non utilisées par la boutique : le catalogue réel vient de la base).
const demoImage = "/placeholder.svg";
const windows11 = demoImage, canva = demoImage, adobe = demoImage, chatgpt = demoImage,
  netflix = demoImage, office = demoImage, spotify = demoImage, aiPack = demoImage;

export type ProductCategory =
  | "ia"
  | "adobe"
  | "windows"
  | "social"
  | "formations";

export type ProductType = "DIGITAL" | "CLÉ" | "COMPTE";

export interface Product {
  id: string;
  name: string;
  image: string;
  type: ProductType;
  delivery: "Compte" | "Clé/Code" | "Après traitement fournisseur";
  price: number;
  oldPrice: number;
  stock: number;
  category: ProductCategory;
  description: string;
  durations?: string[];
  promo: boolean;
}

export const products: Product[] = [
  {
    id: "win11",
    name: "Windows 11 Pro — Licence à vie",
    image: windows11,
    type: "CLÉ",
    delivery: "Clé/Code",
    price: 1500,
    oldPrice: 8000,
    stock: 24,
    category: "windows",
    description: "Activation officielle Microsoft, 1 PC, à vie. Installation guidée incluse.",
    promo: true,
  },
  {
    id: "canva",
    name: "Canva Pro — 1 An",
    image: canva,
    type: "COMPTE",
    delivery: "Compte",
    price: 2500,
    oldPrice: 12000,
    stock: 12,
    category: "social",
    description: "Compte Canva Pro complet 12 mois : Magic Studio, Brand Kit, fonds illimités.",
    durations: ["1 mois", "3 mois", "1 an"],
    promo: true,
  },
  {
    id: "adobe",
    name: "Adobe Creative Cloud — 1 Mois",
    image: adobe,
    type: "COMPTE",
    delivery: "Compte",
    price: 3500,
    oldPrice: 15000,
    stock: 3,
    category: "adobe",
    description: "Suite Adobe complète : Photoshop, Illustrator, Premiere Pro, After Effects.",
    durations: ["1 mois", "3 mois", "1 an"],
    promo: true,
  },
  {
    id: "chatgpt",
    name: "ChatGPT Plus — 1 Mois",
    image: chatgpt,
    type: "COMPTE",
    delivery: "Compte",
    price: 4000,
    oldPrice: 18000,
    stock: 18,
    category: "ia",
    description: "Accès GPT-4o, génération d'images, mode vocal et navigation web avancée.",
    durations: ["1 mois", "3 mois", "1 an"],
    promo: true,
  },
  {
    id: "netflix",
    name: "Netflix Premium — 1 Mois",
    image: netflix,
    type: "COMPTE",
    delivery: "Compte",
    price: 2000,
    oldPrice: 5000,
    stock: 9,
    category: "social",
    description: "4K Ultra HD, 4 écrans simultanés, catalogue complet sans publicité.",
    durations: ["1 mois", "3 mois", "1 an"],
    promo: true,
  },
  {
    id: "office",
    name: "Microsoft Office 365 — 1 An",
    image: office,
    type: "CLÉ",
    delivery: "Clé/Code",
    price: 3000,
    oldPrice: 10000,
    stock: 0,
    category: "windows",
    description: "Word, Excel, PowerPoint, Outlook + 1 To OneDrive. Activation officielle.",
    promo: true,
  },
  {
    id: "spotify",
    name: "Spotify Premium — 1 An",
    image: spotify,
    type: "COMPTE",
    delivery: "Compte",
    price: 3500,
    oldPrice: 16000,
    stock: 21,
    category: "social",
    description: "Musique et podcasts sans publicité, qualité haute, écoute hors-ligne.",
    durations: ["1 mois", "3 mois", "1 an"],
    promo: true,
  },
  {
    id: "ai-pack",
    name: "Pack Formation IA — 50+ Outils",
    image: aiPack,
    type: "DIGITAL",
    delivery: "Clé/Code",
    price: 5000,
    oldPrice: 25000,
    stock: 99,
    category: "formations",
    description: "Formation complète sur 50+ outils IA : ChatGPT, Midjourney, automation, prompt engineering.",
    promo: true,
  },
];

export const formatFCFA = (n: number) =>
  new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export const discountPercent = (price: number, oldPrice: number) =>
  Math.round((1 - price / oldPrice) * 100);
