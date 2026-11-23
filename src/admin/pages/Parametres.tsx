import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { PayDunyaSettings } from "../components/PayDunyaSettings";
import { DigitrustSettings } from "../components/DigitrustSettings";
import { IntegrationsSettings } from "../components/IntegrationsSettings";

interface ShopInfo {
  name: string;
  support_email: string;
  whatsapp: string;
  currency: string;
}

interface PaymentMethods {
  orange_money: boolean;
  wave: boolean;
  mtn: boolean;
  moov: boolean;
  card: boolean;
}

interface NotifTemplates {
  email: string;
  whatsapp: string;
  notify_admin: boolean;
}

interface PrimeMargins {
  usd_rate: number;
  margin_percent: number;
  margin_fixed: number;
}

const DEFAULT_SHOP: ShopInfo = { name: "", support_email: "", whatsapp: "", currency: "XOF" };
const DEFAULT_PAYMENTS: PaymentMethods = {
  orange_money: false, wave: false, mtn: false, moov: false, card: false,
};
const DEFAULT_NOTIF: NotifTemplates = { email: "", whatsapp: "", notify_admin: true };
const DEFAULT_MARGINS: PrimeMargins = { usd_rate: 600, margin_percent: 30, margin_fixed: 500 };

export default function ParametresPage() {
  const [shop, setShop] = useState<ShopInfo>(DEFAULT_SHOP);
  const [payments, setPayments] = useState<PaymentMethods>(DEFAULT_PAYMENTS);
  const [notif, setNotif] = useState<NotifTemplates>(DEFAULT_NOTIF);
  const [twoFa, setTwoFa] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [margins, setMargins] = useState<PrimeMargins>(DEFAULT_MARGINS);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("shop_settings")
        .select("*")
        .in("key", ["public.shop", "payments.methods", "notifications.templates", "security.settings", "primestore.margins"]);
      data?.forEach((d: any) => {
        if (d.key === "public.shop") setShop({ ...DEFAULT_SHOP, ...(d.value || {}) });
        if (d.key === "payments.methods") setPayments({ ...DEFAULT_PAYMENTS, ...(d.value || {}) });
        if (d.key === "notifications.templates") setNotif({ ...DEFAULT_NOTIF, ...(d.value || {}) });
        if (d.key === "security.settings") setTwoFa(!!d.value?.two_fa);
        if (d.key === "primestore.margins") setMargins({ ...DEFAULT_MARGINS, ...(d.value || {}) });
      });
    })();
  }, []);

  const saveShop = async () => {
    const { error } = await supabase.from("shop_settings").upsert({
      key: "public.shop", value: shop as any, updated_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Paramètres enregistrés ✅");
  };

  const savePayments = async () => {
    const { error } = await supabase.from("shop_settings").upsert({
      key: "payments.methods", value: payments as any, updated_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Méthodes de paiement enregistrées ✅");
  };

  const saveNotif = async () => {
    const { error } = await supabase.from("shop_settings").upsert({
      key: "notifications.templates", value: notif as any, updated_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Templates enregistrés ✅");
  };

  const saveSecurity = async () => {
    if (newPassword) {
      if (newPassword.length < 8) return toast.error("Mot de passe trop court (8 caractères min)");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return toast.error(error.message);
      setNewPassword("");
    }
    const { error: e2 } = await supabase.from("shop_settings").upsert({
      key: "security.settings", value: { two_fa: twoFa } as any, updated_at: new Date().toISOString(),
    });
    if (e2) return toast.error(e2.message);
    toast.success("Sécurité mise à jour ✅");
  };

  const saveMargins = async () => {
    if (margins.usd_rate <= 0) return toast.error("Le taux de conversion doit être positif");
    if (margins.margin_percent < 0) return toast.error("La marge en % ne peut pas être négative");
    if (margins.margin_fixed < 0) return toast.error("Le montant fixe ne peut pas être négatif");
    const { error } = await supabase.from("shop_settings").upsert({
      key: "primestore.margins", value: margins as any, updated_at: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    toast.success("Marges enregistrées ✅ — lance une synchronisation pour appliquer les nouveaux prix");
  };

  const syncCatalog = async () => {
    setSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      const { data, error } = await supabase.functions.invoke("sync-primestore-catalog", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(
        `Catalogue synchronisé ✅ — ${(data as any)?.products_upserted ?? 0} produits, ${(data as any)?.categories ?? 0} catégories`,
      );
    } catch (e: any) {
      toast.error(e?.message ?? "Synchronisation échouée");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4 md:space-y-5">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">
        Paramètres
      </h1>

      <Tabs defaultValue="general">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="bg-card inline-flex w-auto">
            <TabsTrigger value="general">Général</TabsTrigger>
            <TabsTrigger value="integrations">Intégrations</TabsTrigger>
            <TabsTrigger value="payments">Paiements</TabsTrigger>
            <TabsTrigger value="supplier">Marges fournisseurs</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
            <TabsTrigger value="team">Équipe</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="general" className="mt-4">
          <Card className="bg-card border-border p-4 sm:p-5 space-y-4 max-w-2xl">
            <div>
              <Label>Nom de la boutique</Label>
              <Input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} className="mt-1.5 bg-background border-border" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Email contact</Label>
                <Input type="email" value={shop.support_email} onChange={(e) => setShop({ ...shop, support_email: e.target.value })} className="mt-1.5 bg-background border-border" />
              </div>
              <div>
                <Label>WhatsApp support</Label>
                <Input value={shop.whatsapp} onChange={(e) => setShop({ ...shop, whatsapp: e.target.value })} className="mt-1.5 bg-background border-border" />
              </div>
            </div>
            <div>
              <Label>Devise</Label>
              <Input value={shop.currency} onChange={(e) => setShop({ ...shop, currency: e.target.value })} className="mt-1.5 bg-background border-border max-w-[120px]" />
            </div>
            <Button onClick={saveShop} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">Enregistrer</Button>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <IntegrationsSettings />
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <Card className="bg-card border-border p-4 sm:p-5 space-y-4 max-w-2xl">
            <PayDunyaSettings />
          </Card>
        </TabsContent>

        <TabsContent value="supplier" className="mt-4">
          <Card className="bg-card border-border p-4 sm:p-5 space-y-4 max-w-2xl">
            <div>
              <h4 className="font-semibold">Fournisseur Prime Labs</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Prix de vente = (prix fournisseur $ × taux) + marge % + montant fixe.
                La clé API se règle dans la page Fournisseurs (stockée chiffrée côté serveur).
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label>Taux $ → FCFA</Label>
                <Input
                  type="number" min={1} value={margins.usd_rate}
                  onChange={(e) => setMargins({ ...margins, usd_rate: Number(e.target.value) })}
                  className="mt-1.5 bg-background border-border"
                />
              </div>
              <div>
                <Label>Marge (%)</Label>
                <Input
                  type="number" min={0} value={margins.margin_percent}
                  onChange={(e) => setMargins({ ...margins, margin_percent: Number(e.target.value) })}
                  className="mt-1.5 bg-background border-border"
                />
              </div>
              <div>
                <Label>Montant fixe (FCFA)</Label>
                <Input
                  type="number" min={0} value={margins.margin_fixed}
                  onChange={(e) => setMargins({ ...margins, margin_fixed: Number(e.target.value) })}
                  className="mt-1.5 bg-background border-border"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={saveMargins} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                Enregistrer les marges
              </Button>
              <Button
                onClick={syncCatalog}
                disabled={syncing}
                variant="outline"
                className="border-primary/40 text-gold-foreground hover:bg-primary/10 w-full sm:w-auto"
              >
                {syncing ? "Synchronisation…" : "🔄 Synchroniser le catalogue"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              La synchronisation importe les produits à livraison instantanée du fournisseur
              et applique tes marges. Les produits qui ne sont plus disponibles sont désactivés.
            </p>
          </Card>
          <DigitrustSettings />
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <Card className="bg-card border-border p-4 sm:p-5 space-y-4 max-w-2xl">
            <div>
              <Label>Template email livraison</Label>
              <Textarea
                rows={6}
                value={notif.email}
                onChange={(e) => setNotif({ ...notif, email: e.target.value })}
                placeholder="Bonjour {{nom}}, voici votre clé : {{cle}}"
                className="mt-1.5 bg-background border-border font-mono text-xs sm:text-sm"
              />
            </div>
            <div>
              <Label>Template WhatsApp</Label>
              <Textarea
                rows={4}
                value={notif.whatsapp}
                onChange={(e) => setNotif({ ...notif, whatsapp: e.target.value })}
                placeholder="✅ Merci ! Voici votre clé : {{cle}}"
                className="mt-1.5 bg-background border-border font-mono text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Notifier l'admin pour chaque commande</Label>
              <Switch checked={notif.notify_admin} onCheckedChange={(v) => setNotif({ ...notif, notify_admin: v })} />
            </div>
            <Button onClick={saveNotif} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">Enregistrer</Button>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <Card className="bg-card border-border p-4 sm:p-5 space-y-4 max-w-2xl">
            <div>
              <Label>Nouveau mot de passe</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Laisser vide pour ne pas modifier"
                className="mt-1.5 bg-background border-border"
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>2FA par WhatsApp</Label>
              <Switch checked={twoFa} onCheckedChange={setTwoFa} />
            </div>
            <Button onClick={saveSecurity} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">Enregistrer</Button>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <Card className="bg-card border-border p-4 sm:p-5 max-w-2xl">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h4 className="font-semibold">Membres de l'équipe</h4>
              <Button size="sm" className="bg-primary hover:bg-primary/90">+ Ajouter</Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Rôles disponibles : <span className="text-primary">Super Admin</span> ·{" "}
              <span className="text-gold-foreground">Gestionnaire</span> ·{" "}
              <span className="text-success">Support</span>.
              Pour ajouter un membre, créez d'abord son compte puis attribuez-lui un rôle.
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
