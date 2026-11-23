import { Navigate, useLocation } from "react-router-dom";
import { useAdminAuth } from "../lib/auth";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loading, user, isAdmin } = useAdminAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="glass rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
          <p className="text-muted-foreground text-sm">
            Votre compte n'a pas les droits administrateur. Contactez un super admin.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
