import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { useSeo } from "@/lib/useSeo";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State =
  | { kind: "validating" }
  | { kind: "ready" }
  | { kind: "already" }
  | { kind: "invalid"; reason?: string }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; reason?: string };

const Unsubscribe = () => {
  useSeo({
    title: "Désabonnement — Pixels Key",
    description: "Désabonnez-vous des emails Pixels Key.",
  });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>({ kind: "validating" });

  useEffect(() => {
    if (!token) {
      setState({ kind: "invalid", reason: "Lien invalide ou incomplet." });
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON_KEY } },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({ kind: "invalid", reason: data?.error ?? "Lien invalide." });
          return;
        }
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setState({ kind: "already" });
        } else {
          setState({ kind: "ready" });
        }
      } catch {
        setState({ kind: "invalid", reason: "Impossible de vérifier le lien." });
      }
    })();
  }, [token]);

  const handleConfirm = async () => {
    setState({ kind: "submitting" });
    try {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ token }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && (data.success || data.reason === "already_unsubscribed")) {
        setState({ kind: "success" });
      } else {
        setState({ kind: "error", reason: data?.error ?? "Une erreur est survenue." });
      }
    } catch {
      setState({ kind: "error", reason: "Réseau indisponible." });
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar search="" onSearch={() => {}} />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-md">
        <div className="rounded-md border border-primary/15 bg-surface p-8 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-display font-extrabold text-2xl mb-2">Désabonnement</h1>

          {state.kind === "validating" && (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Vérification du lien…
            </p>
          )}

          {state.kind === "ready" && (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Confirmez-vous votre désabonnement des emails de Pixels Key ?
                Vous ne recevrez plus de communications de notre part.
              </p>
              <Button
                onClick={handleConfirm}
                className="w-full bg-primary text-primary-foreground hover:bg-gold hover:text-gold-foreground"
              >
                Confirmer mon désabonnement
              </Button>
            </>
          )}

          {state.kind === "submitting" && (
            <p className="text-sm text-muted-foreground inline-flex items-center gap-2 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Traitement en cours…
            </p>
          )}

          {state.kind === "already" && (
            <>
              <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Vous êtes déjà désabonné. Aucune action supplémentaire n'est nécessaire.
              </p>
            </>
          )}

          {state.kind === "success" && (
            <>
              <CheckCircle2 className="h-8 w-8 text-success mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                Vous êtes désormais désabonné. Nous sommes désolés de vous voir partir.
              </p>
              <Button asChild variant="outline" className="border-primary/40 text-primary">
                <Link to="/">Retour à la boutique</Link>
              </Button>
            </>
          )}

          {(state.kind === "invalid" || state.kind === "error") && (
            <>
              <XCircle className="h-8 w-8 text-destructive mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                {state.reason ?? "Une erreur est survenue."}
              </p>
              <Button asChild variant="outline" className="border-primary/40 text-primary">
                <Link to="/">Retour à la boutique</Link>
              </Button>
            </>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Unsubscribe;
