import { LegalLayout } from "@/components/LegalLayout";
import { SUPPORT_EMAIL, WHATSAPP_LINK, WHATSAPP_DISPLAY } from "@/lib/contact";

const Confidentialite = () => (
  <LegalLayout
    title="Confidentialité Pixels Key — Protection de vos données"
    description="Découvrez comment Pixels Key collecte, utilise et protège vos données personnelles. Vos droits, cookies, sécurité et durée de conservation."
  >
    <section>
      <h2 className="font-display font-bold text-xl text-foreground">1. Responsable du traitement</h2>
      <p>
        Pixel Agency, exploitant le site <strong>pixelskey.com</strong>, est responsable du
        traitement des données collectées via la plateforme.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">2. Données collectées</h2>
      <ul className="list-disc pl-6 space-y-1.5">
        <li><strong>Identité :</strong> nom, prénom.</li>
        <li><strong>Contact :</strong> email, numéro WhatsApp.</li>
        <li><strong>Paiement :</strong> traité par nos prestataires (Orange Money, Wave, MTN MoMo, Moov, Stripe). Aucune donnée bancaire n'est stockée chez nous.</li>
        <li><strong>Techniques :</strong> adresse IP, type d'appareil, pages visitées (cookies analytiques).</li>
      </ul>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">3. Finalités</h2>
      <ul className="list-disc pl-6 space-y-1.5">
        <li>Traiter et livrer vos commandes.</li>
        <li>Vous envoyer la clé / licence par email et WhatsApp.</li>
        <li>Assurer le service après-vente.</li>
        <li>Améliorer le site et nos services.</li>
        <li>Vous envoyer des offres promotionnelles (avec votre consentement, désinscription possible à tout moment).</li>
      </ul>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">4. Durée de conservation</h2>
      <p>
        Vos données sont conservées pendant la durée de la relation commerciale, puis archivées
        pendant 3 ans à des fins de prospection, et 10 ans pour les obligations comptables et
        fiscales.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">5. Partage des données</h2>
      <p>
        Vos données ne sont jamais vendues. Elles sont uniquement partagées avec nos prestataires
        techniques (hébergement, paiement, envoi d'emails) dans le cadre strict de l'exécution du
        service.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">6. Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, de suppression, d'opposition et de
        portabilité de vos données. Pour les exercer, contactez-nous :
      </p>
      <p>
        Email :{" "}
        <a className="text-primary hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a><br />
        WhatsApp :{" "}
        <a className="text-primary hover:underline" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">{WHATSAPP_DISPLAY}</a>
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">7. Cookies</h2>
      <p>
        Nous utilisons des cookies nécessaires au fonctionnement du site (panier, session) et des
        cookies analytiques pour mesurer l'audience. Vous pouvez les refuser via les paramètres de
        votre navigateur.
      </p>
    </section>

    <section>
      <h2 className="font-display font-bold text-xl text-foreground">8. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles (chiffrement HTTPS,
        accès restreints, sauvegardes) pour protéger vos données contre tout accès non autorisé.
      </p>
    </section>
  </LegalLayout>
);

export default Confidentialite;
