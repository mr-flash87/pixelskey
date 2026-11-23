import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../lib/format";

interface KeyRow {
  id: string; license_key: string; product_id: string; status: string;
  assigned_at: string | null; order_id: string | null; created_at: string;
}
interface ProductRow { id: string; name: string; type: string }

type Mode = "license" | "account" | "download";

export default function LicencesPage() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [tab, setTab] = useState<"all" | "available" | "sold" | "expired">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [bulkProduct, setBulkProduct] = useState("");

  // license mode
  const [bulk, setBulk] = useState("");
  // account mode (one per line: email|password OR email,password)
  const [accountsBulk, setAccountsBulk] = useState("");
  // download mode (one link per line)
  const [linksBulk, setLinksBulk] = useState("");

  const selectedProduct = products.find((p) => p.id === bulkProduct);
  const mode: Mode = (selectedProduct?.type as Mode) ?? "license";

  const load = async () => {
    const { data: k } = await supabase.from("license_keys").select("*").order("created_at", { ascending: false }).limit(500);
    setKeys((k ?? []) as KeyRow[]);
    const { data: p } = await supabase.from("products").select("id, name, type").order("name");
    setProducts((p ?? []) as ProductRow[]);
  };
  useEffect(() => { load(); }, []);

  const filtered = keys.filter((k) => {
    if (tab !== "all" && k.status !== tab) return false;
    if (productFilter !== "all" && k.product_id !== productFilter) return false;
    return true;
  });

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  const importBulk = async () => {
    if (!bulkProduct) return toast.error("Sélectionnez un produit");

    let entries: string[] = [];
    if (mode === "account") {
      // Accept "email|password" or "email,password" or "email password"
      entries = accountsBulk.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const parts = l.split(/[|,;\t]| {2,}/).map((s) => s.trim()).filter(Boolean);
        if (parts.length < 2) return l; // fallback raw
        return `${parts[0]} | ${parts.slice(1).join(" ")}`;
      });
      if (!entries.length) return toast.error("Aucun compte détecté (format: email|motdepasse)");
    } else if (mode === "download") {
      entries = linksBulk.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!entries.length) return toast.error("Aucun lien détecté");
      const bad = entries.find((l) => !/^https?:\/\//i.test(l));
      if (bad) return toast.error(`Lien invalide : ${bad}`);
    } else {
      entries = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
      if (!entries.length) return toast.error("Aucune clé détectée");
    }

    const rows = entries.map((license_key) => ({ license_key, product_id: bulkProduct, status: "available" as const }));
    const { error } = await supabase.from("license_keys").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${entries.length} ${mode === "account" ? "comptes" : mode === "download" ? "liens" : "clés"} importés ✅`);
    setBulk(""); setAccountsBulk(""); setLinksBulk(""); setBulkProduct(""); setOpen(false); load();
  };

  const statusBadge = (s: string) => {
    if (s === "available") return <Badge className="bg-success/10 text-success border-0">Disponible</Badge>;
    if (s === "sold") return <Badge className="bg-muted text-muted-foreground border-0">Utilisée</Badge>;
    if (s === "expired") return <Badge className="bg-destructive/15 text-destructive border-0">Expirée</Badge>;
    return <Badge className="bg-primary/15 text-primary border-0">Réservée</Badge>;
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Licences & Clés</h1>
        <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus size={16} className="mr-1.5" /> Importer des clés
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {[
          { k: "all", l: "Toutes" }, { k: "available", l: "Disponibles" },
          { k: "sold", l: "Utilisées" }, { k: "expired", l: "Expirées" },
        ].map((t) => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              tab === t.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}>{t.l}</button>
        ))}
        <div className="ml-auto w-full sm:w-64">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger className="bg-background border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les produits</SelectItem>
              {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr className="text-left">
                <th className="p-3">Clé</th>
                <th className="p-3">Produit</th>
                <th className="p-3">Statut</th>
                <th className="p-3 hidden md:table-cell">Attribuée</th>
                <th className="p-3 hidden lg:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((k) => (
                <tr key={k.id} className="border-t border-border hover:bg-muted/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs">
                        {show[k.id] ? k.license_key : k.license_key.replace(/./g, "•").slice(0, 18)}
                      </code>
                      <button onClick={() => setShow((s) => ({ ...s, [k.id]: !s[k.id] }))} className="text-muted-foreground hover:text-foreground">
                        {show[k.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">{productName(k.product_id)}</td>
                  <td className="p-3">{statusBadge(k.status)}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground text-xs">
                    {k.assigned_at ? formatDate(k.assigned_at) : "—"}
                  </td>
                  <td className="p-3 hidden lg:table-cell text-muted-foreground text-xs">{formatDate(k.created_at)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-muted-foreground text-sm">Aucune clé</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-l border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Ajouter du stock</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Produit associé</Label>
              <Select value={bulkProduct} onValueChange={setBulkProduct}>
                <SelectTrigger className="mt-1.5 bg-background border-border"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-muted-foreground text-xs">· {p.type}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedProduct && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Type : <span className="text-foreground font-medium">{mode === "account" ? "Compte (email + mot de passe)" : mode === "download" ? "Lien de téléchargement" : "Clé de licence"}</span>
                </p>
              )}
            </div>

            {mode === "license" && (
              <div>
                <Label>Clés (une par ligne)</Label>
                <Textarea rows={10} value={bulk} onChange={(e) => setBulk(e.target.value)}
                  placeholder="XXXXX-XXXXX-XXXXX-XXXXX&#10;YYYYY-YYYYY-YYYYY-YYYYY"
                  className="mt-1.5 bg-background border-border font-mono text-xs" />
                <p className="text-xs text-muted-foreground mt-1">
                  {bulk.split("\n").filter((l) => l.trim()).length} clés détectées
                </p>
              </div>
            )}

            {mode === "account" && (
              <div>
                <Label>Comptes (un par ligne — format : <code>email|motdepasse</code>)</Label>
                <Textarea rows={10} value={accountsBulk} onChange={(e) => setAccountsBulk(e.target.value)}
                  placeholder={"client1@netflix.com|MotDePasse123\nclient2@netflix.com|Autre456"}
                  className="mt-1.5 bg-background border-border font-mono text-xs" />
                <p className="text-xs text-muted-foreground mt-1">
                  Séparateurs : <code>|</code>, <code>,</code>, <code>;</code> ou tab. {accountsBulk.split("\n").filter((l) => l.trim()).length} compte(s)
                </p>
              </div>
            )}

            {mode === "download" && (
              <div>
                <Label>Liens (un par ligne)</Label>
                <Textarea rows={10} value={linksBulk} onChange={(e) => setLinksBulk(e.target.value)}
                  placeholder={"https://drive.google.com/file/abc\nhttps://mega.nz/xyz"}
                  className="mt-1.5 bg-background border-border font-mono text-xs" />
                <p className="text-xs text-muted-foreground mt-1">
                  {linksBulk.split("\n").filter((l) => l.trim()).length} lien(s) détecté(s)
                </p>
              </div>
            )}

            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground">
              💡 Après chaque paiement réussi, le contenu est automatiquement attribué au client et envoyé par email.
            </div>

            <Button className="w-full bg-primary hover:bg-primary/90" onClick={importBulk} disabled={!bulkProduct}>
              Ajouter au stock
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
