import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Globe, Mail, Pencil, Phone, Plus, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { IntegrationBlock, type FieldDef } from "../components/IntegrationBlock";
import { readSecrets, type SecretsState } from "../lib/integrations";

export type SupplierKind = "manual" | "primestore" | "digitrust";
export interface Supplier {
  id: string;
  name: string;
  kind: SupplierKind;
  website: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
}

const KIND_LABEL: Record<SupplierKind, string> = {
  manual: "Manuel (sans API)",
  primestore: "Prime Labs (API)",
  digitrust: "Digitrust (API)",
};

const API_FIELDS: Record<Exclude<SupplierKind, "manual">, FieldDef[]> = {
  primestore: [
    { name: "PRIMESTORE_API_KEY", label: "Clé API Prime Labs", sensitive: true, help: "Dans ton compte Prime Labs (pirmestore.mylabsstore.com), rubrique API." },
  ],
  digitrust: [
    { name: "DIGITRUST_API_URL", label: "Adresse de l'API Digitrust", placeholder: "https://…/api/v2", help: "L'adresse de base indiquée dans la documentation API Digitrust." },
    { name: "DIGITRUST_AUTH_HEADER", label: "En-tête d'authentification (optionnel)", placeholder: "Authorization", help: "Laisse vide sauf si Digitrust demande un autre en-tête (ex. X-API-Key)." },
    { name: "DIGITRUST_API_KEY", label: "Clé API Digitrust", sensitive: true },
  ],
};

const EMPTY: Omit<Supplier, "id"> = { name: "", kind: "manual", website: "", contact_email: "", contact_phone: "", notes: "", is_active: true };

export default function FournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [secrets, setSecrets] = useState<SecretsState | null>(null);
  const [editing, setEditing] = useState<(Omit<Supplier, "id"> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [openApi, setOpenApi] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const db = supabase as any;
    const [{ data, error }, { data: products }] = await Promise.all([
      db.from("suppliers").select("*").order("created_at"),
      db.from("products").select("supplier_id, source"),
    ]);
    if (error) toast.error("Impossible de charger les fournisseurs");
    const list = (data as Supplier[]) ?? [];
    const c: Record<string, number> = {};
    for (const s of list) {
      c[s.id] = (products ?? []).filter((p: { supplier_id: string | null; source: string | null }) =>
        p.supplier_id === s.id || (s.kind !== "manual" && !p.supplier_id && p.source === s.kind)).length;
    }
    setSuppliers(list);
    setCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    readSecrets().then(setSecrets).catch(() => setSecrets({}));
  }, [load]);

  const usedApiKinds = useMemo(() => new Set(suppliers.filter((s) => s.kind !== "manual").map((s) => s.kind)), [suppliers]);

  const save = async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return toast.error("Donne un nom au fournisseur");
    const row = {
      name,
      kind: editing.kind,
      website: editing.website?.trim() || null,
      contact_email: editing.contact_email?.trim() || null,
      contact_phone: editing.contact_phone?.trim() || null,
      notes: editing.notes?.trim() || null,
      is_active: editing.is_active,
    };
    setSaving(true);
    const db = supabase as any;
    const { error } = editing.id
      ? await db.from("suppliers").update(row).eq("id", editing.id)
      : await db.from("suppliers").insert(row);
    setSaving(false);
    if (error) {
      return toast.error(error.code === "23505" ? "Un fournisseur de ce type API existe déjà" : error.message);
    }
    toast.success(editing.id ? "Fournisseur mis à jour ✅" : "Fournisseur ajouté ✅");
    setEditing(null);
    load();
  };

  const remove = async (s: Supplier) => {
    const n = counts[s.id] ?? 0;
    if (!confirm(`Supprimer « ${s.name} » ?${n ? ` Ses ${n} produit(s) resteront en boutique, sans fournisseur.` : ""}`)) return;
    const { error } = await (supabase as any).from("suppliers").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Fournisseur supprimé");
    load();
  };

  const toggleActive = async (s: Supplier, value: boolean) => {
    const { error } = await (supabase as any).from("suppliers").update({ is_active: value }).eq("id", s.id);
    if (error) return toast.error(error.message);
    setSuppliers((list) => list.map((x) => (x.id === s.id ? { ...x, is_active: value } : x)));
  };

  const apiConfigured = (kind: SupplierKind) =>
    kind === "manual" || API_FIELDS[kind].filter((f) => f.sensitive || f.name === "DIGITRUST_API_URL").every((f) => secrets?.[f.name]?.set);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Fournisseurs</h1>
          <p className="text-sm text-muted-foreground">
            Ajoute autant de fournisseurs que tu veux. Les fournisseurs « Manuel » n'ont pas d'API :
            tu leur achètes les produits toi-même, puis tu ajoutes les clés dans <strong>Licences / Clés</strong>.
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY })} className="bg-primary hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Ajouter un fournisseur
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : suppliers.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Aucun fournisseur pour le moment.</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {suppliers.map((s) => (
            <Card key={s.id} className={`bg-card border-border p-4 sm:p-5 space-y-3 ${s.is_active ? "" : "opacity-70"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Truck size={18} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{s.name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{KIND_LABEL[s.kind]}</Badge>
                      {s.kind !== "manual" && (apiConfigured(s.kind)
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-600">API configurée</Badge>
                        : <Badge variant="destructive">Clé API manquante</Badge>)}
                      <Badge variant="outline">{counts[s.id] ?? 0} produit(s)</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch checked={s.is_active} onCheckedChange={(v) => toggleActive(s, v)} aria-label="Actif" />
                </div>
              </div>

              <div className="space-y-1 text-sm text-muted-foreground">
                {s.website && <p className="flex items-center gap-2 truncate"><Globe size={14} /> <a href={s.website} target="_blank" rel="noreferrer" className="hover:underline truncate">{s.website}</a></p>}
                {s.contact_email && <p className="flex items-center gap-2"><Mail size={14} /> {s.contact_email}</p>}
                {s.contact_phone && <p className="flex items-center gap-2"><Phone size={14} /> {s.contact_phone}</p>}
                {s.notes && <p className="whitespace-pre-line text-xs">{s.notes}</p>}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...s })}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Modifier</Button>
                {s.kind !== "manual" && (
                  <Button size="sm" variant="outline" onClick={() => setOpenApi(openApi === s.id ? null : s.id)}>
                    {openApi === s.id ? <ChevronUp className="mr-1.5 h-3.5 w-3.5" /> : <ChevronDown className="mr-1.5 h-3.5 w-3.5" />}
                    Connexion API
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(s)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer
                </Button>
              </div>

              {s.kind !== "manual" && openApi === s.id && (
                <div className="border-t border-border pt-3 space-y-2">
                  <IntegrationBlock fields={API_FIELDS[s.kind]} secrets={secrets} onSaved={setSecrets} testTarget={s.kind} saveLabel="Enregistrer la clé" />
                  <p className="text-[11px] text-muted-foreground">
                    Les marges et la synchronisation du catalogue se règlent dans <strong>Paramètres → Fournisseurs</strong>.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Modifier le fournisseur" : "Nouveau fournisseur"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="sup-name">Nom</Label>
                <Input id="sup-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ex. Grossiste Licences Pro" className="mt-1.5" />
              </div>
              <div>
                <Label>Type</Label>
                <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v as SupplierKind })} disabled={!!editing.id}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{KIND_LABEL.manual}</SelectItem>
                    <SelectItem value="primestore" disabled={usedApiKinds.has("primestore")}>{KIND_LABEL.primestore}{usedApiKinds.has("primestore") ? " — déjà ajouté" : ""}</SelectItem>
                    <SelectItem value="digitrust" disabled={usedApiKinds.has("digitrust")}>{KIND_LABEL.digitrust}{usedApiKinds.has("digitrust") ? " — déjà ajouté" : ""}</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  « Manuel » convient à n'importe quel fournisseur. Les types API achètent et livrent automatiquement.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="sup-email">E-mail</Label>
                  <Input id="sup-email" type="email" value={editing.contact_email ?? ""} onChange={(e) => setEditing({ ...editing, contact_email: e.target.value })} className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="sup-phone">Téléphone / WhatsApp</Label>
                  <Input id="sup-phone" value={editing.contact_phone ?? ""} onChange={(e) => setEditing({ ...editing, contact_phone: e.target.value })} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label htmlFor="sup-web">Site web</Label>
                <Input id="sup-web" value={editing.website ?? ""} onChange={(e) => setEditing({ ...editing, website: e.target.value })} placeholder="https://…" className="mt-1.5" />
              </div>
              <div>
                <Label htmlFor="sup-notes">Notes</Label>
                <Textarea id="sup-notes" rows={3} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} placeholder="Conditions, délais, moyen de paiement…" className="mt-1.5" />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="sup-active">Actif</Label>
                <Switch id="sup-active" checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={save} disabled={saving} className="bg-primary hover:bg-primary/90">{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
