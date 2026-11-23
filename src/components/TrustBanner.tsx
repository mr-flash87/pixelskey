import { Zap, Lock, Headphones } from "lucide-react";

const items = [
  {
    icon: Zap,
    title: "Livraison instantanée",
    desc: "Email & WhatsApp automatique après paiement",
    color: "text-primary",
  },
  {
    icon: Lock,
    title: "Paiements sécurisés",
    desc: "Chiffrement SSL 256-bit, transactions vérifiées",
    color: "text-gold",
  },
  {
    icon: Headphones,
    title: "Support Premium",
    desc: "Aide à l'activation dédiée 7j/7",
    color: "text-primary",
  },
];

export const TrustBanner = () => (
  <section className="border-y border-primary/10 bg-surface/50">
    <div className="container mx-auto px-4 py-10 grid md:grid-cols-3 gap-6">
      {items.map((it) => (
        <div
          key={it.title}
          className="flex items-start gap-4 p-4 rounded-xl bg-surface border border-primary/10"
        >
          <div className="p-3 rounded-lg bg-primary/10">
            <it.icon className={`h-6 w-6 ${it.color}`} />
          </div>
          <div>
            <h3 className="font-display font-bold text-lg">{it.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{it.desc}</p>
          </div>
        </div>
      ))}
    </div>
  </section>
);
