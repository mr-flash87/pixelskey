import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil, KeyRound, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { formatXOF } from "../lib/format";
import { ImageUploader } from "../components/ImageUploader";
import { TierEditor } from "../components/TierEditor";

interface Product {
  id: string; name: string; slug: string; description: string;
  category: string; type: string; price: number; old_price: number | null;
  is_active: boolean; featured: boolean; instant_delivery: boolean;
  duration: string | null; image_url: string | null; promo: boolean;
  display_order: number;
  stock: number;
  promo_start_at: string | null; promo_end_at: string | null;
}

const empty: Partial<Product> = {
  name: "", slug: "", description: "", category: "other", type: "license",
  price: 0, old_price: null, is_active: true, featured: false, instant_delivery: true,
  duration: "lifetime", image_url: null, promo: false, display_order: 0,
  stock: 0, promo_start_at: null, promo_end_at: null,
};

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const productSchema = z.object({
  name: z.string().trim().min(2, "Nom requis (2 caractères min)").max(120, "Nom trop long"),
  slug: z.string().trim().regex(slugRe, "Slug invalide (minuscules, chiffres, tirets)").max(80),
  description: z.string().trim().max(2000, "Description trop longue").optional().or(z.literal("")),
  price: z.number({ invalid_type_error: "Prix requis" }).int().min(100, "Prix minimum 100 FCFA").max(10_000_000),
  old_price: z.number().int().positive().nullable().optional(),
  stock: z.number().int().min(0, "Stock négatif interdit").max(100_000),
  type: z.enum(["license", "account", "download"]),
  category: z.string().min(1),
  instant_delivery: z.boolean(),
  duration: z.string().nullable().optional(),
  promo_start_at: z.string().nullable().optional(),
  promo_end_at: z.string().nullable().optional(),
}).superRefine((v, ctx) => {
  if (v.old_price != null && v.old_price <= v.price) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["old_price"],
      message: "Prix original doit être supérieur au prix de vente" });
  }
  if (v.promo_start_at && v.promo_end_at) {
    const s = new Date(v.promo_start_at).getTime();
    const e = new Date(v.promo_end_at).getTime();
    if (s >= e) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["promo_end_at"],
      message: "Fin de promo doit être après le début" });
  }
  if (v.type === "download" && !v.instant_delivery) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["instant_delivery"],
      message: "Téléchargement = livraison instantanée obligatoire" });
  }
});

export default function ProduitsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [categoriesList, setCategoriesList] = useState<{ slug: string; name: string }[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "in_stock" | "out" | "featured">("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Product>>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setProducts((data ?? []) as Product[]);
    const { data: keys } = await supabase.from("license_keys").select("product_id, status").eq("status", "available");
    const map: Record<string, number> = {};
    keys?.forEach((k: any) => { map[k.product_id] = (map[k.product_id] ?? 0) + 1; });
    setStockMap(map);
    const { data: cats } = await supabase.from("categories").select("slug, name").order("display_order").order("name");
    setCategoriesList(cats ?? []);
  };

  useEffect(() => { load(); }, []);

  const filtered = products.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    const stock = stockMap[p.id] ?? 0;
    if (filter === "in_stock" && stock <= 0) return false;
    if (filter === "out" && stock > 0) return false;
    if (filter === "featured" && !p.featured) return false;
    return true;
  });

  const discount = (p: Partial<Product>) => {
    if (!p.old_price || !p.price) return 0;
    return Math.round(((p.old_price - p.price) / p.old_price) * 100);
  };

  const save = async () => {
    const autoSlug = (editing.slug || (editing.name ?? ""))
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

    const candidate = {
      name: editing.name ?? "",
      slug: autoSlug,
      description: editing.description ?? "",
      price: Number(editing.price ?? 0),
      old_price: editing.old_price == null || editing.old_price === ("" as any)
        ? null : Number(editing.old_price),
      stock: Number(editing.stock ?? 0),
      type: (editing.type ?? "license") as "license" | "account" | "download",
      category: editing.category ?? "other",
      instant_delivery: !!editing.instant_delivery,
      duration: editing.duration || null,
      promo_start_at: editing.promo_start_at || null,
      promo_end_at: editing.promo_end_at || null,
    };

    const parsed = productSchema.safeParse(candidate);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path[0]?.toString() ?? "_";
        if (!e[k]) e[k] = iss.message;
      });
      setErrors(e);
      toast.error("Veuillez corriger les erreurs du formulaire");
      return;
    }
    setErrors({});

    const payload = {
      ...editing,
      ...parsed.data,
      promo: candidate.old_price != null && candidate.old_price > candidate.price,
    };

    if (editing.id) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Produit mis à jour ✅");
    } else {
      const { error } = await supabase.from("products").insert(payload as any);
      if (error) return toast.error(error.message);
      toast.success("Produit créé ✅");
    }
    setOpen(false); setEditing(empty); setErrors({}); load();
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produit supprimé ❌");
    load();
  };

  const toggleActive = async (p: Product) => {
    await supabase.from("products").update({ is_active: !p.is_active }).eq("id", p.id);
    toast.success(p.is_active ? "Désactivé" : "Activé ✅");
    load();
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
            Produits ({products.length})
          </h1>
        </div>
        <Button onClick={() => { setEditing(empty); setOpen(true); }} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus size={16} className="mr-1.5" /> Ajouter un produit
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        {[
          { k: "all", l: "Tous" }, { k: "in_stock", l: "En stock" },
          { k: "out", l: "Rupture" }, { k: "featured", l: "Mis en avant" },
        ].map((f) => (
          <button
            key={f.k} onClick={() => setFilter(f.k as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f.k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >{f.l}</button>
        ))}
        <div className="relative ml-auto w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className="pl-9 bg-background border-border" />
        </div>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr className="text-left">
                <th className="p-3">Image</th>
                <th className="p-3">Nom</th>
                <th className="p-3 hidden md:table-cell">Catégorie</th>
                <th className="p-3 hidden lg:table-cell">Type</th>
                <th className="p-3">Prix</th>
                <th className="p-3 hidden md:table-cell">Stock</th>
                <th className="p-3">Actif</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stock = stockMap[p.id] ?? 0;
                const d = discount(p);
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/50">
                    <td className="p-3">
                      <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          : <span className="text-lg">📦</span>}
                      </div>
                    </td>
                    <td className="p-3 font-medium">{p.name}{p.featured && <Badge className="ml-2 bg-gold/20 text-gold-foreground border-0">★</Badge>}</td>
                    <td className="p-3 hidden md:table-cell text-muted-foreground capitalize">{p.category}</td>
                    <td className="p-3 hidden lg:table-cell">
                      <Badge className={p.type === "account" ? "bg-primary/10 text-primary border-0" : "bg-gold/20 text-gold-foreground border-0"}>
                        {p.type === "account" ? "COMPTE" : "CLÉ"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold">{formatXOF(p.price)}</div>
                      {p.old_price && (
                        <div className="text-xs text-muted-foreground line-through">{formatXOF(p.old_price)}</div>
                      )}
                      {d > 0 && <Badge className="bg-destructive/15 text-destructive border-0 text-[10px]">-{d}%</Badge>}
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <span className={stock < 5 ? "text-destructive" : "text-foreground"}>{stock}</span>
                    </td>
                    <td className="p-3"><Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} /></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}>
                          <Pencil size={14} />
                        </Button>
                        <Button size="icon" variant="ghost" title="Gérer les clés"><KeyRound size={14} /></Button>
                        <Button size="icon" variant="ghost" onClick={() => del(p.id)} className="text-destructive">
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">Aucun produit</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Slide-in editor */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-l border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing.id ? "Modifier le produit" : "Nouveau produit"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom du produit</Label>
              <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5 bg-background border-border" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Slug (URL)</Label>
              <Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="auto-généré depuis le nom"
                className="mt-1.5 bg-background border-border font-mono text-xs" />
              {errors.slug && <p className="text-xs text-destructive mt-1">{errors.slug}</p>}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="mt-1.5 bg-background border-border" />
              {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Catégorie</Label>
                <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                  <SelectTrigger className="mt-1.5 bg-background border-border">
                    <SelectValue placeholder={categoriesList.length ? "Choisir…" : "Aucune catégorie — créez-en"} />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriesList.length === 0 ? (
                      <SelectItem value="other" disabled>Aucune catégorie disponible</SelectItem>
                    ) : (
                      categoriesList.map((c) => (
                        <SelectItem key={c.slug} value={c.slug}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type de livraison</Label>
                <Select value={editing.type} onValueChange={(v) => setEditing({ ...editing, type: v })}>
                  <SelectTrigger className="mt-1.5 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="license">Clé / Code</SelectItem>
                    <SelectItem value="account">Compte</SelectItem>
                    <SelectItem value="download">Lien téléchargement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Prix original (FCFA)</Label>
                <Input type="number" value={editing.old_price ?? ""} onChange={(e) => setEditing({ ...editing, old_price: e.target.value ? Number(e.target.value) : null })} className="mt-1.5 bg-background border-border" />
                {errors.old_price && <p className="text-xs text-destructive mt-1">{errors.old_price}</p>}
              </div>
              <div>
                <Label>Prix de vente (FCFA)</Label>
                <Input type="number" value={editing.price ?? ""} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="mt-1.5 bg-background border-border" />
                {errors.price && <p className="text-xs text-destructive mt-1">{errors.price}</p>}
              </div>
            </div>
            {discount(editing) > 0 && (
              <Badge className="bg-destructive/15 text-destructive border-0">-{discount(editing)}% calculé</Badge>
            )}
            <div>
              <Label>Stock total (clés disponibles)</Label>
              <Input type="number" min={0} value={editing.stock ?? 0}
                onChange={(e) => setEditing({ ...editing, stock: Number(e.target.value) })}
                className="mt-1.5 bg-background border-border" />
              {errors.stock && <p className="text-xs text-destructive mt-1">{errors.stock}</p>}
            </div>

            {/* Paliers de durée */}
            <div className="rounded-lg border border-primary/20 p-3 bg-muted/50 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-primary">
                  Paliers de durée & prix
                </Label>
                <span className="text-[10px] text-muted-foreground">1 mois → à vie</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Définissez plusieurs durées avec leur prix. Le client choisira sur la page produit.
                Si vide, le prix de vente ci-dessus sera utilisé.
              </p>
              <TierEditor productId={editing.id ?? ""} />
            </div>

            {/* Promotion programmée */}
            <div className="rounded-lg border border-border p-3 bg-muted/50 space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Fenêtre de promotion (optionnelle)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Début</Label>
                  <Input type="datetime-local"
                    value={editing.promo_start_at ? editing.promo_start_at.slice(0, 16) : ""}
                    onChange={(e) => setEditing({
                      ...editing,
                      promo_start_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })}
                    className="mt-1.5 bg-background border-border" />
                </div>
                <div>
                  <Label className="text-xs">Fin</Label>
                  <Input type="datetime-local"
                    value={editing.promo_end_at ? editing.promo_end_at.slice(0, 16) : ""}
                    onChange={(e) => setEditing({
                      ...editing,
                      promo_end_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                    })}
                    className="mt-1.5 bg-background border-border" />
                  {errors.promo_end_at && <p className="text-xs text-destructive mt-1">{errors.promo_end_at}</p>}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pendant cette fenêtre, le prix de vente s'applique. Hors fenêtre, c'est le prix original.
              </p>
            </div>

            <div>
              <Label>Image du produit</Label>
              <div className="mt-1.5">
                <ImageUploader
                  value={editing.image_url ?? null}
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div>
                <div className="flex items-center justify-between"><Label>Livraison instantanée</Label>
                  <Switch checked={!!editing.instant_delivery} onCheckedChange={(v) => setEditing({ ...editing, instant_delivery: v })} /></div>
                {errors.instant_delivery && <p className="text-xs text-destructive mt-1">{errors.instant_delivery}</p>}
              </div>
              <div className="flex items-center justify-between"><Label>Mettre en avant</Label>
                <Switch checked={!!editing.featured} onCheckedChange={(v) => setEditing({ ...editing, featured: v })} /></div>
              <div className="flex items-center justify-between"><Label>Produit actif</Label>
                <Switch checked={!!editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /></div>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annuler</Button>
              <Button className="flex-1 bg-primary hover:bg-primary/90" onClick={save}>Enregistrer</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
