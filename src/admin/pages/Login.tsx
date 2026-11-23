import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "../lib/auth";
import { toast } from "sonner";

export default function AdminLogin() {
  const { signIn, user, isAdmin, loading } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate("/admin", { replace: true });
  }, [user, isAdmin, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) toast.error(error.message ?? "Identifiants invalides");
    else toast.success("Connexion réussie");
  };

  return (
    <div className="min-h-screen bg-surface text-foreground flex items-center justify-center p-4 relative overflow-hidden">
      <div className="relative w-full max-w-md bg-card border border-border rounded-lg p-8 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <ShieldCheck className="text-primary" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              Pixels<span className="text-primary">Key</span> Admin
            </h1>
            <p className="text-xs text-muted-foreground">Panneau d'administration</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@pixelskey.com"
              required
              className="mt-1.5 bg-background border-border"
            />
          </div>
          <div>
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background border-border pr-10"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-11"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : "Connexion"}
          </Button>

          <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground">
            Mot de passe oublié&nbsp;?
          </button>
        </form>

        <p className="text-center text-[11px] text-muted-foreground mt-6 pt-6 border-t border-border">
          Accès réservé à l'équipe Pixel Agency
        </p>
      </div>
    </div>
  );
}
