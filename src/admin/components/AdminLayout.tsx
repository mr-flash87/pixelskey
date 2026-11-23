import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, Tags, Package, Users, KeyRound, Wallet,
  Megaphone, Settings, RefreshCw, LogOut, Truck, Search, Bell, Menu, X,
} from "lucide-react";
import { useState } from "react";
import { useAdminAuth } from "../lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/produits", label: "Produits", icon: ShoppingBag },
  { to: "/admin/categories", label: "Catégories", icon: Tags },
  { to: "/admin/commandes", label: "Commandes", icon: Package },
  { to: "/admin/clients", label: "Clients", icon: Users },
  { to: "/admin/licences", label: "Licences / Clés", icon: KeyRound },
  { to: "/admin/finances", label: "Finances", icon: Wallet },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/fournisseurs", label: "Fournisseurs", icon: Truck },
  { to: "/admin/synchronisations", label: "Synchronisations", icon: RefreshCw },
  { to: "/admin/parametres", label: "Paramètres", icon: Settings },
];

export function AdminLayout() {
  const { user, signOut } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut();
    toast.success("Déconnexion réussie");
    navigate("/admin/login");
  };

  const initials = (user?.email ?? "A").slice(0, 2).toUpperCase();
  const segments = location.pathname.split("/").filter(Boolean);
  const breadcrumb = segments.length <= 1 ? "Dashboard" : segments[1].replace(/-/g, " ");

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-[260px] bg-card border-r border-border flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="p-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xl font-bold">
                Pixels<span className="text-primary">Key</span>
              </div>
              <span className="inline-block mt-1 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30">
                Admin Panel
              </span>
            </div>
            <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="mt-4 flex items-center gap-3 p-2 rounded-xl bg-muted">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.email?.split("@")[0] ?? "Admin"}</div>
              <div className="text-[11px] text-muted-foreground">Super Admin</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-colors ${
                  isActive
                    ? "bg-primary/15 text-primary border-l-[3px] border-primary pl-[9px]"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 bg-foreground/60 z-30" onClick={() => setOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/95 backdrop-blur-md flex items-center px-4 gap-3 sticky top-0 z-20">
          <button className="lg:hidden text-muted-foreground" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="text-sm text-muted-foreground capitalize hidden sm:block">
            Admin / <span className="text-foreground">{breadcrumb}</span>
          </div>
          <div className="flex-1 max-w-md ml-auto relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Rechercher…" className="pl-9 bg-background border-border" />
          </div>
          <Button variant="ghost" size="icon" className="relative">
            <Bell size={18} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
          </Button>
          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
            {initials}
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
