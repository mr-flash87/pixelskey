import { LegalLayout } from "@/components/LegalLayout";
import { WHATSAPP_LINK, WHATSAPP_DISPLAY, SUPPORT_EMAIL } from "@/lib/contact";

const Cgv = () => (
  <LegalLayout
    title="CGV Pixels Key — Conditions de vente des licences"
    description="Conditions Générales de Vente Pixels Key : achat de licences, clés d'activation, abonnements & formations. Paiement, livraison, garantie."
  >
    <section>
      <h2 className="font-display font-bold text-xl text-foreground">1. Préambule</h2>
      <p>
        Les présentes Conditions Générales de Vente (« CGV ») régissent toute commande passée
        sur <strong>pixelskey.com</strong>, exploité par <strong>Pixel Agency</strong> (Ouagadougou,
        Burkina Faso). Toute commande implique l'acceptation pleine et entière des présentes CGV.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">2. Produits</h2>
      <p>
        Pixels Key commercialise des produits numériques : licences logicielles, clés d'activation,
        comptes premium, abonnements IA et formations en ligne. Les caractéristiques essentielles de
        chaque produit sont décrites sur sa fiche.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">3. Prix et paiement</h2>
      <p>
        Les prix sont affichés en FCFA, toutes taxes comprises. Le paiement s'effectue via Orange
        Money, Wave, MTN MoMo, Moov Money ou carte bancaire. La commande n'est confirmée qu'après
        encaissement effectif.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">4. Livraison</h2>
      <p>
        La livraison est <strong>instantanée et numérique</strong>. La clé / le lien d'accès est
        envoyé par email et / ou par WhatsApp dans un délai maximum de <strong>15 minutes</strong>
        après confirmation du paiement. En cas de retard, contactez-nous sur WhatsApp{" "}
        <a className="text-primary hover:underline" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
          {WHATSAPP_DISPLAY}
        </a>.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">5. Garantie</h2>
      <p>
        Toutes nos clés et licences sont garanties fonctionnelles à la livraison. Une garantie de
        remplacement est offerte selon la durée mentionnée sur la fiche produit (généralement 24h
        à 12 mois selon le type de licence).
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">6. Droit de rétractation</h2>
      <p>
        Conformément à la législation applicable aux biens numériques, le droit de rétractation ne
        s'applique pas une fois que la clé a été révélée ou téléchargée. Voir notre{" "}
        <a className="text-primary hover:underline" href="/remboursement">Politique de remboursement</a>.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">7. Responsabilité</h2>
      <p>
        Pixels Key ne peut être tenu responsable d'un usage abusif d'une licence ou d'un partage
        non autorisé. Le client s'engage à respecter les conditions d'utilisation de l'éditeur du
        logiciel concerné.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">8. Service client</h2>
      <p>
        Pour toute question :<br />
        Email : <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><br />
        WhatsApp : <a className="text-primary hover:underline" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">{WHATSAPP_DISPLAY}</a>
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">9. Droit applicable</h2>
      <p>
        Les présentes CGV sont soumises au droit du Burkina Faso. Tout litige sera porté devant les
        tribunaux compétents de Ouagadougou, à défaut de règlement amiable.
      </p>
    </section>
  </LegalLayout>
);

export default Cgv;
