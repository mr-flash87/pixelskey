import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";

export interface Category {
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

interface CategoriesState {
  categories: Category[];
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  reload: () => Promise<void>;
}

export const useCategories = create<CategoriesState>((set, get) => ({
  categories: [],
  loaded: false,
  loading: false,
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    set({ categories: (data ?? []) as Category[], loaded: true, loading: false });
  },
  reload: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("name", { ascending: true });
    set({ categories: (data ?? []) as Category[], loaded: true, loading: false });
  },
}));
