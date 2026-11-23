import { ArrowUpRight, CreditCard, MessageCircle, MapPin, Mail, Phone, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { WHATSAPP_LINK, WHATSAPP_DISPLAY, SUPPORT_EMAIL } from "@/lib/contact";
import orangeMoney from "@/assets/payments/orange_money.svg.asset.json";
import wave from "@/assets/payments/wave.png.asset.json";
import mtnMomo from "@/assets/payments/mtn_momo.svg.asset.json";
import moovMoney from "@/assets/payments/moov-money-bf.png.asset.json";

const mobilePayments = [
  { name: "Orange Money", logo: orangeMoney.url },
  { name: "Wave", logo: wave.url },
  { name: "MTN MoMo", logo: mtnMomo.url },
  { name: "Moov Money", logo: moovMoney.url },
];

export const Footer = () => (
  <footer className="mt-16 border-t border-border bg-surface text-foreground">
    <section aria-labelledby="footer-faq-title" className="bg-background">
      <div className="container mx-auto grid gap-6 px-4 py-10 sm:py-12 lg:grid-cols-[1fr_2fr] lg:gap-16">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">Votre achat, en toute confiance</p>
          <h2 id="footer-faq-title" className="font-display text-2xl font-extrabold text-primary">Questions fréquentes</h2>
        </div>
        <Accordion type="single" collapsible className="min-w-0 border-t border-border">
          <AccordionItem value="delivery" className="border-border">
            <AccordionTrigger className="gap-4 text-left text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Comment recevoir ma clé ou mes accès après l’achat ?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">Après confirmation du paiement, votre clé, votre lien ou vos accès sont disponibles sur la page de votre commande. Un email récapitulatif est également envoyé à l’adresse indiquée lors de l’achat. Le délai peut varier selon le produit et la confirmation du paiement.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="missing" className="border-border">
            <AccordionTrigger className="gap-4 text-left text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Je n’ai pas reçu ma clé ou mon email, que faire ?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">Consultez la page de votre commande et vérifiez les spams de votre boîte mail. Si vos accès ne sont pas disponibles alors que vous avez payé, contactez-nous sur <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">WhatsApp</a> avec votre référence de commande. Ne recommencez pas le paiement avant vérification.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="payment" className="border-border">
            <AccordionTrigger className="gap-4 text-left text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Puis-je payer avec Mobile Money ?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">Oui, le paiement passe par PayDunya. Les moyens proposés, comme Orange Money, Wave, MTN MoMo ou Moov Money, dépendent de votre pays et des options disponibles sur la page de paiement. Les prix de la boutique sont affichés en FCFA.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="support" className="border-border">
            <AccordionTrigger className="gap-4 text-left text-sm font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Comment contacter le support WhatsApp ?</AccordionTrigger>
            <AccordionContent className="leading-6 text-muted-foreground">Écrivez-nous au <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-4">{WHATSAPP_DISPLAY}</a> ou utilisez le bouton « Nous contacter ». Précisez le produit concerné et votre référence de commande si vous avez déjà acheté. Ne partagez jamais votre code PIN Mobile Money ni vos codes de validation.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
    <div className="bg-background">
      <div className="container mx-auto flex flex-col items-start justify-between gap-5 px-4 py-7 sm:flex-row sm:items-center sm:py-9">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gold/25 text-primary">
            <MessageCircle className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-lg font-extrabold sm:text-xl">Une question sur votre commande ?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Contactez l’équipe Pixels Key.</p>
          </div>
        </div>
        <Button asChild className="h-11 w-full gap-3 px-5 sm:w-auto">
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> Nous contacter <ArrowUpRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </div>

    <div className="container mx-auto px-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-9 border-t border-border py-10 sm:py-12 lg:grid-cols-[1.4fr_0.8fr_1fr_1.2fr] lg:gap-10">
        <div className="col-span-2 min-w-0 lg:col-span-1">
          <Link to="/" aria-label="Pixels Key — Accueil" className="inline-block rounded-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="font-display text-3xl font-extrabold">Pixels<span className="italic">Key</span><span className="text-gold">.</span></span>
          </Link>
          <p className="mt-2 text-xs font-bold text-muted-foreground">by Pixel Agency</p>
          <p className="mt-4 max-w-xs text-sm leading-6 text-muted-foreground">
            Licences, abonnements et outils digitaux à prix accessibles pour les entrepreneurs et créateurs africains.
          </p>
        </div>

        <nav aria-label="Boutique en pied de page" className="min-w-0">
          <h3 className="mb-4 text-sm font-extrabold text-primary">Boutique</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link to="/" className="inline-block py-2 transition-colors hover:text-primary hover:underline underline-offset-4">Tous les produits</Link></li>
            <li><Link to="/promotions" className="inline-flex items-center gap-2 py-2 transition-colors hover:text-primary hover:underline underline-offset-4">Promotions <span className="h-1.5 w-1.5 rounded-full bg-promo" aria-hidden="true" /></Link></li>
          </ul>
        </nav>

        <nav aria-label="Informations en pied de page" className="min-w-0">
          <h3 className="mb-4 text-sm font-extrabold text-primary">Informations</h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li><Link to="/cgv" className="inline-block py-2 transition-colors hover:text-primary hover:underline underline-offset-4">Conditions générales de vente</Link></li>
            <li><Link to="/confidentialite" className="inline-block py-2 transition-colors hover:text-primary hover:underline underline-offset-4">Politique de confidentialité</Link></li>
            <li><Link to="/remboursement" className="inline-block py-2 transition-colors hover:text-primary hover:underline underline-offset-4">Politique de remboursement</Link></li>
          </ul>
        </nav>

        <div className="col-span-2 min-w-0 border-t border-border pt-7 lg:col-span-1 lg:border-0 lg:pt-0">
          <h3 className="mb-4 text-sm font-extrabold text-primary">Restons en contact</h3>
          <ul className="space-y-4 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <span>Ouagadougou, Burkina Faso</span>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <a href={`mailto:${SUPPORT_EMAIL}`} className="min-w-0 hover:text-primary hover:underline underline-offset-4">{SUPPORT_EMAIL}</a>
            </li>
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline underline-offset-4">{WHATSAPP_DISPLAY}</a>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-border py-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-primary">
          <Smartphone className="h-4 w-4" aria-hidden="true" />
          <span>Mobile Money & carte</span>
        </div>
        <ul aria-label="Moyens de paiement" className="flex flex-wrap gap-2">
          {mobilePayments.map((payment) => (
            <li key={payment.name} className="flex h-14 w-28 items-center justify-center rounded border border-border bg-background px-3 py-2">
              <img src={payment.logo} alt={payment.name} width="88" height="36" className="h-9 w-full object-contain" loading="lazy" />
            </li>
          ))}
          <li className="inline-flex h-14 w-28 items-center justify-center gap-2 rounded border border-border bg-background px-3 text-xs font-semibold text-foreground">
            <CreditCard className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Visa
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pb-24 pt-5 text-xs leading-5 text-muted-foreground sm:flex-row sm:justify-between sm:pb-7 sm:pr-20">
        <p>© {new Date().getFullYear()} Pixels Key · Pixel Agency</p>
        <p>Tous droits réservés. · Prix en FCFA</p>
      </div>
    </div>
  </footer>
);
