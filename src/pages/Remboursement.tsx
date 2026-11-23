import { LegalLayout } from "@/components/LegalLayout";
import { WHATSAPP_LINK, WHATSAPP_DISPLAY, SUPPORT_EMAIL } from "@/lib/contact";

const Remboursement = () => (
  <LegalLayout
    title="Remboursement Pixels Key — Garantie & procédure"
    description="Politique de remboursement Pixels Key : cas couverts, délais de 7 jours, procédure WhatsApp et garantie de remplacement sur vos licences."
  >
    <section>
      <h2 className="font-display font-bold text-xl text-foreground">1. Principe général</h2>
      <p>
        Nos produits étant <strong>numériques et livrés instantanément</strong>, le droit de
        rétractation classique ne s'applique pas dès lors que la clé a été révélée. Toutefois,
        Pixels Key applique une politique de remboursement étendue afin de garantir votre
        satisfaction.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">2. Cas de remboursement intégral</h2>
      <ul className="list-disc pl-6 space-y-1.5">
        <li>La clé / licence ne fonctionne pas et ne peut pas être remplacée.</li>
        <li>Le produit est indisponible après paiement.</li>
        <li>Erreur technique de notre part lors de la livraison.</li>
        <li>Double paiement constaté.</li>
      </ul>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">3. Cas non remboursables</h2>
      <ul className="list-disc pl-6 space-y-1.5">
        <li>Clé déjà activée par le client puis demande de remboursement.</li>
        <li>Erreur d'achat (mauvais produit choisi) après activation.</li>
        <li>Incompatibilité non vérifiée avec votre matériel ou pays (vérifier la fiche produit).</li>
        <li>Formations consultées à plus de 25 % du contenu.</li>
      </ul>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">4. Délai pour réclamer</h2>
      <p>
        Toute demande doit être formulée dans un <strong>délai de 7 jours</strong> à compter de la
        livraison de la clé. Au-delà, seule la garantie de remplacement (selon la fiche produit)
        reste applicable.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">5. Procédure</h2>
      <ol className="list-decimal pl-6 space-y-1.5">
        <li>Contactez-nous via WhatsApp ou email avec votre numéro de commande.</li>
        <li>Décrivez précisément le problème (captures d'écran si possible).</li>
        <li>Notre équipe répond sous 24h ouvrées.</li>
        <li>Si le remboursement est validé, il est effectué sous 3 à 7 jours sur le moyen de paiement initial.</li>
      </ol>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">6. Contact</h2>
      <p>
        WhatsApp :{" "}
        <a className="text-primary hover:underline" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
          {WHATSAPP_DISPLAY}
        </a>
        <br />
        Email :{" "}
        <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </section>
  </LegalLayout>
);

export default Remboursement;
