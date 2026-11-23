import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Product from "./pages/Product.tsx";
import Checkout from "./pages/Checkout.tsx";
import OrderPage from "./pages/Order.tsx";
import Category from "./pages/Category.tsx";
import Promotions from "./pages/Promotions.tsx";
import NotFound from "./pages/NotFound.tsx";
import Cgv from "./pages/Cgv.tsx";
import Remboursement from "./pages/Remboursement.tsx";
import Confidentialite from "./pages/Confidentialite.tsx";
import Unsubscribe from "./pages/Unsubscribe.tsx";
import ScrollToTop from "./components/ScrollToTop";

import { AdminAuthProvider } from "./admin/lib/auth";
import { ProtectedRoute } from "./admin/components/ProtectedRoute";
import { AdminLayout } from "./admin/components/AdminLayout";
import AdminLogin from "./admin/pages/Login";
import Dashboard from "./admin/pages/Dashboard";
import Produits from "./admin/pages/Produits";
import Categories from "./admin/pages/Categories";
import Commandes from "./admin/pages/Commandes";
import Clients from "./admin/pages/Clients";
import Licences from "./admin/pages/Licences";
import Finances from "./admin/pages/Finances";
import Marketing from "./admin/pages/Marketing";
import Synchronisations from "./admin/pages/Synchronisations";
import Fournisseurs from "./admin/pages/Fournisseurs";
import Parametres from "./admin/pages/Parametres";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <AdminAuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/produit/:id" element={<Product />} />
            <Route path="/c/:slug" element={<Category />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order/:id" element={<OrderPage />} />
            <Route path="/cgv" element={<Cgv />} />
            <Route path="/remboursement" element={<Remboursement />} />
            <Route path="/confidentialite" element={<Confidentialite />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Admin */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="produits" element={<Produits />} />
              <Route path="categories" element={<Categories />} />
              <Route path="commandes" element={<Commandes />} />
              <Route path="clients" element={<Clients />} />
              <Route path="licences" element={<Licences />} />
              <Route path="finances" element={<Finances />} />
              <Route path="marketing" element={<Marketing />} />
              <Route path="fournisseurs" element={<Fournisseurs />} />
              <Route path="synchronisations" element={<Synchronisations />} />
              <Route path="parametres" element={<Parametres />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AdminAuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
