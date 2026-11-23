import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SecretState } from "../lib/integrations";

/** Champ de clé : une clé sensible déjà enregistrée n'est jamais réaffichée (seulement ses 4 derniers caractères). */
export function SecretField({
  id, label, state, value, onChange, sensitive, placeholder, help,
}: {
  id: string; label: string; state?: SecretState; value: string; onChange: (v: string) => void;
  sensitive?: boolean; placeholder?: string; help?: string;
}) {
  const configured = state?.set;
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {configured ? (
          <span className="text-[11px] text-emerald-600">
            ✓ Configurée{sensitive && state?.hint ? ` (${state.hint})` : ""}{state?.source === "supabase" ? " · secret Supabase" : ""}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">Non configurée</span>
        )}
      </div>
      <Input
        id={id}
        type={sensitive ? "password" : "text"}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={sensitive && configured ? "Laisser vide pour garder la clé actuelle" : placeholder}
        className="mt-1.5 bg-background border-border"
      />
      {help && <p className="mt-1 text-[11px] text-muted-foreground">{help}</p>}
    </div>
  );
}
