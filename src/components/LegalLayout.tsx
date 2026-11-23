import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { useSeo } from "@/lib/useSeo";

interface LegalLayoutProps {
  title: string;
  description: string;
  updatedAt?: string;
  children: React.ReactNode;
}

export const LegalLayout = ({ title, description, updatedAt = "Avril 2026", children }: LegalLayoutProps) => {
  useSeo({ title: `${title} — Pixels Key`, description });
  useEffect(() => { window.scrollTo(0, 0); }, []);
  return (
    <div className="min-h-screen bg-background">
      <Navbar search="" onSearch={() => {}} />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <nav className="text-xs text-muted-foreground mb-4">
          <Link to="/" className="hover:text-primary">Accueil</Link> <span className="mx-1">/</span>{" "}
          <span className="text-foreground">{title}</span>
        </nav>
        <h1 className="font-display font-extrabold text-3xl sm:text-4xl mb-2">
          {title}
        </h1>
        <p className="text-xs text-muted-foreground mb-8">Dernière mise à jour : {updatedAt}</p>
        <article className="prose-legal space-y-6 text-sm leading-relaxed text-foreground/90">
          {children}
        </article>
      </main>
      <Footer />
      <WhatsAppFab />
    </div>
  );
};
