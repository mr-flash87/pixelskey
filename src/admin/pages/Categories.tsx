import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUploader } from "../components/ImageUploader";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  meta_title: string | null;
  meta_description: string | null;
}

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  name: z.string().trim().min(2, "Nom requis (2 caractères min)").max(80),
  slug: z.string().trim().regex(slugRe, "Slug invalide (minuscules, chiffres, tirets)").max(60),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  display_order: z.number().int().min(0).max(9999),
  meta_title: z.string().max(160).nullable().optional(),
  meta_description: z.string().max(300).nullable().optional(),
});

const empty: Partial<Category> = {
  name: "", slug: "", description: "", image_url: null,
  display_order: 0, is_active: true, meta_title: null, meta_description: null,
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export default function CategoriesPage() {
  const [items, setItems] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Category>>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await supabase.from("categories").select("*").order("display_order").order("name");
    setItems((data ?? []) as Category[]);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const candidate = {
      name: editing.name ?? "",
      slug: editing.slug ? editing.slug : slugify(editing.name ?? ""),
      description: editing.description ?? "",
      display_order: Number(editing.display_order ?? 0),
      meta_title: editing.meta_title || null,
      meta_description: editing.meta_description || null,
    };
    const parsed = schema.safeParse(candidate);
    if (!parsed.success) {
      const e: Record<string, string> = {};
      parsed.error.issues.forEach((iss) => {
        const k = iss.path[0]?.toString() ?? "_";
        if (!e[k]) e[k] = iss.message;
      });
      setErrors(e);
      toast.error("Veuillez corriger le formulaire");
      return;
    }
    setErrors({});

    const payload = {
      ...parsed.data,
      image_url: editing.image_url ?? null,
      is_active: editing.is_active ?? true,
    };

    if (editing.id) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Catégorie mise à jour ✅");
    } else {
      const { error } = await supabase.from("categories").insert(payload as any);
      if (error) return toast.error(error.message);
      toast.success("Catégorie créée ✅");
    }
    setOpen(false); setEditing(empty); load();
  };

  const del = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Supprimée ❌");
    load();
  };

  const toggleActive = async (c: Category) => {
    await supabase.from("categories").update({ is_active: !c.is_active }).eq("id", c.id);
    load();
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
          Catégories ({items.length})
        </h1>
        <Button
          onClick={() => { setEditing(empty); setErrors({}); setOpen(true); }}
          className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
        >
          <Plus size={16} className="mr-1.5" /> Nouvelle catégorie
        </Button>
      </div>

      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm min-w-[640px]">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr className="text-left">
                <th className="p-3">Image</th>
                <th className="p-3">Nom</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Ordre</th>
                <th className="p-3">Actif</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/50">
                  <td className="p-3">
                    <div className="w-10 h-10 rounded-lg bg-muted overflow-hidden flex items-center justify-center">
                      {c.image_url
                        ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                        : <span className="text-lg">🏷️</span>}
                    </div>
                  </td>
                  <td className="p-3 font-medium">{c.name}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">/c/{c.slug}</td>
                  <td className="p-3">{c.display_order}</td>
                  <td className="p-3">
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost"
                        onClick={() => { setEditing(c); setErrors({}); setOpen(true); }}>
                        <Pencil size={14} />
                      </Button>
                      <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => del(c.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">
                  Aucune catégorie. Créez-en une pour commencer.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg bg-card border-l border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing.id ? "Modifier la catégorie" : "Nouvelle catégorie"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom</Label>
              <Input
                value={editing.name ?? ""}
                onChange={(e) => {
                  const name = e.target.value;
                  setEditing((cur) => ({
                    ...cur,
                    name,
                    slug: cur.id ? cur.slug : slugify(name),
                  }));
                }}
                placeholder="ex: Logiciels Windows"
                className="mt-1.5 bg-background border-border"
              />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name}</p>}
            </div>
            <div>
              <Label>Slug (URL : /c/...)</Label>
              <Input
                value={editing.slug ?? ""}
                onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                placeholder="logiciels-windows"
                className="mt-1.5 bg-background border-border font-mono text-xs"
              />
              {errors.slug && <p className="text-xs text-destructive mt-1">{errors.slug}</p>}
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="Description courte affichée sur la page de la catégorie"
                className="mt-1.5 bg-background border-border"
              />
            </div>
            <div>
              <Label>Image de la catégorie</Label>
              <div className="mt-1.5">
                <ImageUploader
                  value={editing.image_url ?? ""}
                  onChange={(url) => setEditing({ ...editing, image_url: url })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Ordre d'affichage</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.display_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) })}
                  className="mt-1.5 bg-background border-border"
                />
              </div>
              <div className="flex items-end">
                <div className="flex items-center justify-between gap-3 w-full pb-2">
                  <Label>Active</Label>
                  <Switch
                    checked={editing.is_active ?? true}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-border p-3 bg-muted/50 space-y-3">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">SEO (optionnel)</Label>
              <div>
                <Label className="text-xs">Meta title</Label>
                <Input
                  value={editing.meta_title ?? ""}
                  onChange={(e) => setEditing({ ...editing, meta_title: e.target.value || null })}
                  className="mt-1.5 bg-background border-border"
                />
              </div>
              <div>
                <Label className="text-xs">Meta description</Label>
                <Textarea
                  rows={2}
                  value={editing.meta_description ?? ""}
                  onChange={(e) => setEditing({ ...editing, meta_description: e.target.value || null })}
                  className="mt-1.5 bg-background border-border"
                />
              </div>
            </div>
            {editing.id && (
              <Badge className="bg-muted text-muted-foreground border-0 font-mono text-xs">
                ID : {editing.id}
              </Badge>
            )}
            <Button onClick={save} className="w-full bg-primary hover:bg-primary/90">
              {editing.id ? "Enregistrer" : "Créer la catégorie"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
