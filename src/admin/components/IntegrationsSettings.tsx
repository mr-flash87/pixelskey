import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { IntegrationBlock, type FieldDef } from "./IntegrationBlock";
import { readSecrets, type SecretsState } from "../lib/integrations";

const BREVO_FIELDS: FieldDef[] = [
  { name: "BREVO_API_KEY", label: "Clé API Brevo", sensitive: true, placeholder: "xkeysib-…", help: "Brevo → ton nom (en haut à droite) → SMTP & API → Clés API → Générer une nouvelle clé." },
  { name: "BREVO_SENDER_EMAIL", label: "E-mail expéditeur", placeholder: "noreply@pixelskey.app", help: "Doit être validé dans Brevo → Expéditeurs, domaines et IP." },
  { name: "BREVO_SENDER_NAME", label: "Nom expéditeur", placeholder: "Pixels Key" },
  { name: "ADMIN_NOTIFICATION_EMAIL", label: "E-mail qui reçoit les alertes de vente", placeholder: "toi@exemple.com" },
];

const AI_FIELDS: FieldDef[] = [
  { name: "AI_API_KEY", label: "Clé API IA", sensitive: true, placeholder: "sk-…", help: "Clé OpenAI (platform.openai.com → API keys) ou d'un service compatible (OpenRouter, Groq…)." },
  { name: "AI_BASE_URL", label: "Adresse de l'API (optionnel)", placeholder: "https://api.openai.com/v1" },
  { name: "AI_MODEL", label: "Modèle (optionnel)", placeholder: "gpt-4o-mini" },
];

export function IntegrationsSettings() {
  const [secrets, setSecrets] = useState<SecretsState | null>(null);

  useEffect(() => {
    readSecrets().then(setSecrets).catch((e) => toast.error(e instanceof Error ? e.message : "Chargement impossible"));
  }, []);

  return (
    <div className="space-y-4 max-w-2xl">
      <Card className="bg-card border-border p-4 sm:p-5 space-y-4">
        <div>
          <h4 className="font-semibold">E-mails (Brevo)</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Sert à envoyer les clés aux clients, les confirmations de commande et les relances.
            Les clés sont chiffrées sur le serveur et ne sont jamais réaffichées.
          </p>
        </div>
        <IntegrationBlock fields={BREVO_FIELDS} secrets={secrets} onSaved={setSecrets} testTarget="brevo" />
      </Card>

      <Card className="bg-card border-border p-4 sm:p-5 space-y-4">
        <div>
          <h4 className="font-semibold">Intelligence artificielle (facultatif)</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Sert uniquement à traduire automatiquement les fiches produits des fournisseurs.
          </p>
        </div>
        <IntegrationBlock fields={AI_FIELDS} secrets={secrets} onSaved={setSecrets} testTarget="ai" />
      </Card>

      <p className="text-xs text-muted-foreground">
        Les clés des fournisseurs (Prime Labs, Digitrust…) se règlent dans la page <strong>Fournisseurs</strong>,
        et PayDunya dans l'onglet <strong>Paiements</strong>.
      </p>
    </div>
  );
}
