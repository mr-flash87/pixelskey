import { MessageCircle } from "lucide-react";
import { WHATSAPP_LINK } from "@/lib/contact";

export const WhatsAppFab = () => (
  <a
    href={`${WHATSAPP_LINK}?text=${encodeURIComponent("Bonjour Pixels Key, j'ai besoin d'aide 👋")}`}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Discuter sur WhatsApp"
    className="fixed bottom-5 right-5 z-40 group"
  >
    <span className="absolute inset-0 rounded-full bg-success animate-ping opacity-30" />
    <span className="relative flex items-center justify-center h-14 w-14 rounded-full bg-success text-success-foreground hover:scale-110 transition-transform">
      <MessageCircle className="h-6 w-6" />
    </span>
    <span className="absolute right-16 top-1/2 -translate-y-1/2 hidden md:group-hover:block whitespace-nowrap bg-surface border border-primary/20 text-foreground text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg">
      Chat WhatsApp
    </span>
  </a>
);
