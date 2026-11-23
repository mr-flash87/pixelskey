import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "../lib/format";

interface PromoCode {
  id: string; code: string; kind: "percent" | "amount"; value: number;
  max_uses: number | null; uses_count: number;
  starts_at: string | null; expires_at: string | null;
  min_order_amount: number; is_active: boolean;
}

export default function MarketingPage() {
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<PromoCode>>({ code: "", kind: "percent", value: 10, is_active: true });
  const [target, setTarget] = useState("all");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await supabase.from("promo_codes").select("*").order("created_at", { ascending: false });
    setPromos((data ?? []) as PromoCode[]);
  };
  useEffect(() => { load(); }, []);

  const random = () => {
    const c = Array.from({ length: 8 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]).join("");
    setForm((f) => ({ ...f, code: c }));
  };

  const create = async () => {
    const code = (form.code ?? "").trim().toUpperCase();
    if (!code || code.length < 3) return toast.error("Code requis (3 caractères min)");
    if (!/^[A-Z0-9_-]+$/.test(code)) return toast.error("Code: lettres/chiffres uniquement");
    const value = Number(form.value);
    if (!Number.isFinite(value) || value <= 0) return toast.error("Valeur invalide");
    if (form.kind === "percent" && value > 100) return toast.error("Pourcentage max 100");
    if (form.starts_at && form.expires_at && new Date(form.starts_at) >= new Date(form.expires_at)) {
      return toast.error("La date de fin doit être après le début");
    }
    const payload = { ...form, code, min_order_amount: form.min_order_amount ?? 0 };
    const { error } = await supabase.from("promo_codes").insert(payload as any);
    if (error) return toast.error(error.message);
    toast.success("Code promo créé ✅");
    setOpen(false);
    setForm({ code: "", kind: "percent", value: 10, is_active: true });
    load();
  };

  const del = async (id: string) => {
    await supabase.from("promo_codes").delete().eq("id", id);
    toast.success("Supprimé ❌"); load();
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Marketing</h1>

      <Tabs defaultValue="promos">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-card inline-flex w-auto">
            <TabsTrigger value="promos">Codes promo</TabsTrigger>
            <TabsTrigger value="featured">Mises en avant</TabsTrigger>
            <TabsTrigger value="campaign">Notifications</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="promos" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={() => setOpen(true)} className="bg-primary hover:bg-primary/90 w-full sm:w-auto"><Plus size={16} className="mr-1.5" /> Créer un code</Button>
          </div>
          <Card className="bg-card border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm min-w-[640px]">
                <thead className="bg-muted text-muted-foreground text-xs">
                  <tr className="text-left">
                    <th className="p-3">Code</th><th className="p-3">Réduction</th>
                    <th className="p-3">Utilisations</th><th className="p-3">Expiration</th>
                    <th className="p-3">Statut</th><th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="p-3"><code className="font-mono font-bold">{p.code}</code></td>
                      <td className="p-3">{p.kind === "percent" ? `${p.value}%` : `${p.value} FCFA`}</td>
                      <td className="p-3">{p.uses_count}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
                      <td className="p-3 text-xs text-muted-foreground">{p.expires_at ? formatDate(p.expires_at) : "—"}</td>
                      <td className="p-3">
                        {p.is_active ? <Badge className="bg-success/10 text-success border-0">Actif</Badge>
                          : <Badge className="bg-muted text-muted-foreground border-0">Inactif</Badge>}
                      </td>
                      <td className="p-3 text-right">
                        <Button size="icon" variant="ghost" onClick={() => del(p.id)} className="text-destructive"><Trash2 size={14} /></Button>
                      </td>
                    </tr>
                  ))}
                  {promos.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground text-sm">Aucun code promo</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="featured" className="mt-4">
          <Card className="bg-card border-border p-5 text-sm text-muted-foreground">
            Activez le toggle « Mettre en avant » sur la fiche d'un produit dans la page Produits.
            L'ordre est défini par la date de création (le plus récent en premier).
          </Card>
        </TabsContent>

        <TabsContent value="campaign" className="space-y-4 mt-4">
          <Card className="bg-card border-border p-5 space-y-4">
            <div>
              <Label>Cible</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="mt-1.5 bg-background border-border"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les clients</SelectItem>
                  <SelectItem value="inactive">Inactifs (30j)</SelectItem>
                  <SelectItem value="vip">VIP (&gt; 5 commandes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={6} value={msg} onChange={(e) => setMsg(e.target.value)}
                placeholder="Saisissez le contenu de votre notification…"
                className="mt-1.5 bg-background border-border" />
            </div>
            <p className="text-xs text-muted-foreground">
              L'envoi de campagnes WhatsApp/Email sera disponible une fois le provider de notifications connecté.
            </p>
            <Button
              disabled={!msg.trim()}
              onClick={() => { toast("Configuration du provider requise"); }}
              className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
            ><Send size={14} className="mr-1.5" /> Envoyer la campagne</Button>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border border-border">
          <DialogHeader><DialogTitle>Nouveau code promo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Code</Label>
              <div className="flex gap-2 mt-1.5">
                <Input value={form.code ?? ""} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="bg-background border-border font-mono uppercase" />
                <Button variant="outline" onClick={random}>Aléatoire</Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as any })}>
                  <SelectTrigger className="mt-1.5 bg-background border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Pourcentage (%)</SelectItem>
                    <SelectItem value="amount">Montant (FCFA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input type="number" value={form.value ?? ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} className="mt-1.5 bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Limite d'utilisation</Label>
                <Input type="number" value={form.max_uses ?? ""} onChange={(e) => setForm({ ...form, max_uses: e.target.value ? Number(e.target.value) : null })} className="mt-1.5 bg-background border-border" />
              </div>
              <div>
                <Label>Montant min. panier (FCFA)</Label>
                <Input type="number" min={0} value={form.min_order_amount ?? 0}
                  onChange={(e) => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                  className="mt-1.5 bg-background border-border" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Date de début</Label>
                <Input type="datetime-local"
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="mt-1.5 bg-background border-border" />
              </div>
              <div>
                <Label>Date d'expiration</Label>
                <Input type="datetime-local"
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="mt-1.5 bg-background border-border" />
              </div>
            </div>
            <Button className="w-full bg-primary hover:bg-primary/90" onClick={create}>Créer le code</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
