import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { DURATION_OPTIONS, durationLabel } from "@/lib/durations";

interface Tier {
  id: string;
  product_id: string;
  duration: string;
  label: string;
  price: number;
  old_price: number | null;
  stock: number;
  display_order: number;
  is_active: boolean;
}

interface Props {
  productId: string;
}

export function TierEditor({ productId }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<{ duration: string; price: string; old_price: string }>({
    duration: "1_month", price: "", old_price: "",
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_tiers")
      .select("*")
      .eq("product_id", productId)
      .order("display_order")
      .order("price");
    if (error) toast.error(error.message);
    setTiers((data ?? []) as Tier[]);
    setLoading(false);
  };

  useEffect(() => { if (productId) load(); }, [productId]);

  const add = async () => {
    const price = Number(draft.price);
    const oldPrice = draft.old_price ? Number(draft.old_price) : null;
    if (!draft.duration) return toast.error("Choisissez une durée");
    if (!price || price < 100) return toast.error("Prix minimum 100 FCFA");
    if (tiers.some((t) => t.duration === draft.duration)) {
      return toast.error("Cette durée existe déjà");
    }
    const { error } = await supabase.from("product_tiers").insert({
      product_id: productId,
      duration: draft.duration,
      label: durationLabel(draft.duration),
      price,
      old_price: oldPrice,
      display_order: tiers.length,
      stock: 0,
      is_active: true,
    });
    if (error) return toast.error(error.message);
    toast.success("Palier ajouté ✅");
    setDraft({ duration: "1_month", price: "", old_price: "" });
    load();
  };

  const update = async (id: string, patch: Partial<Tier>) => {
    const { error } = await supabase.from("product_tiers").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    setTiers((s) => s.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce palier ?")) return;
    const { error } = await supabase.from("product_tiers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Palier supprimé");
    load();
  };

  const usedDurations = new Set(tiers.map((t) => t.duration));
  const availableDurations = DURATION_OPTIONS.filter((d) => !usedDurations.has(d.value));

  if (!productId) {
    return (
      <p className="text-xs text-muted-foreground">
        Enregistrez d'abord le produit pour ajouter des paliers de durée.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-xs text-muted-foreground">Chargement…</p>
      ) : tiers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aucun palier. Le prix de base du produit sera utilisé.
        </p>
      ) : (
        <div className="space-y-2">
          {tiers.map((t) => (
            <div key={t.id} className="grid grid-cols-12 gap-2 items-center bg-background rounded-lg p-2 border border-border">
              <div className="col-span-3 text-xs font-medium">{durationLabel(t.duration)}</div>
              <div className="col-span-3">
                <Input
                  type="number" value={t.price}
                  onChange={(e) => update(t.id, { price: Number(e.target.value) })}
                  className="bg-card border-border h-8 text-xs"
                  placeholder="Prix"
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="number" value={t.old_price ?? ""}
                  onChange={(e) => update(t.id, { old_price: e.target.value ? Number(e.target.value) : null })}
                  className="bg-card border-border h-8 text-xs"
                  placeholder="Prix barré"
                />
              </div>
              <div className="col-span-2 flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={t.is_active}
                  onChange={(e) => update(t.id, { is_active: e.target.checked })}
                  className="accent-primary"
                />
                <span className="text-[10px] text-muted-foreground">actif</span>
              </div>
              <div className="col-span-1 text-right">
                <Button size="icon" variant="ghost" onClick={() => del(t.id)} className="h-7 w-7 text-destructive">
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {availableDurations.length > 0 && (
        <div className="grid grid-cols-12 gap-2 items-end pt-2 border-t border-border">
          <div className="col-span-4">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Durée</Label>
            <Select value={draft.duration} onValueChange={(v) => setDraft({ ...draft, duration: v })}>
              <SelectTrigger className="mt-1 bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableDurations.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Prix</Label>
            <Input type="number" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              className="mt-1 bg-background border-border h-8 text-xs" placeholder="3000" />
          </div>
          <div className="col-span-3">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Prix barré</Label>
            <Input type="number" value={draft.old_price} onChange={(e) => setDraft({ ...draft, old_price: e.target.value })}
              className="mt-1 bg-background border-border h-8 text-xs" placeholder="optionnel" />
          </div>
          <div className="col-span-2">
            <Button onClick={add} className="w-full bg-primary hover:bg-primary/90 h-8 text-xs">
              <Plus size={12} className="mr-1" /> Ajouter
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
