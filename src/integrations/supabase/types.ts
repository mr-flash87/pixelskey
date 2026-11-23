export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json
          resource: string | null
          resource_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json
          resource?: string | null
          resource_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      catalog_sync_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          products_created: number
          products_instant: number
          products_total: number
          products_updated: number
          started_at: string
          status: string
          supplier: string
          trigger: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          products_created?: number
          products_instant?: number
          products_total?: number
          products_updated?: number
          started_at?: string
          status?: string
          supplier?: string
          trigger?: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          products_created?: number
          products_instant?: number
          products_total?: number
          products_updated?: number
          started_at?: string
          status?: string
          supplier?: string
          trigger?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          primestore_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          primestore_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          primestore_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      digitrust_purchase_attempts: {
        Row: {
          error: string | null
          order_item_id: string
          status: string
          supplier_order_id: string | null
          updated_at: string
        }
        Insert: {
          error?: string | null
          order_item_id: string
          status?: string
          supplier_order_id?: string | null
          updated_at?: string
        }
        Update: {
          error?: string | null
          order_item_id?: string
          status?: string
          supplier_order_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "digitrust_purchase_attempts_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      license_deliveries: {
        Row: {
          content: string
          created_at: string
          digitrust_order_id: string | null
          error: string | null
          id: string
          order_id: string
          order_item_id: string | null
          primestore_order_id: string | null
          status: string
        }
        Insert: {
          content?: string
          created_at?: string
          digitrust_order_id?: string | null
          error?: string | null
          id?: string
          order_id: string
          order_item_id?: string | null
          primestore_order_id?: string | null
          status?: string
        }
        Update: {
          content?: string
          created_at?: string
          digitrust_order_id?: string | null
          error?: string | null
          id?: string
          order_id?: string
          order_item_id?: string | null
          primestore_order_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "license_deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_deliveries_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      license_keys: {
        Row: {
          assigned_at: string | null
          created_at: string
          id: string
          license_key: string
          notes: string | null
          order_id: string | null
          product_id: string
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          created_at?: string
          id?: string
          license_key: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          created_at?: string
          id?: string
          license_key?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_license_keys_order"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "license_keys_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          duration: string | null
          duration_label: string | null
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          tier_id: string | null
          unit_price: number
        }
        Insert: {
          created_at?: string
          duration?: string | null
          duration_label?: string | null
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          tier_id?: string | null
          unit_price: number
        }
        Update: {
          created_at?: string
          duration?: string | null
          duration_label?: string | null
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          tier_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "product_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          customer_email: string
          customer_name: string | null
          customer_phone: string | null
          delivery_attempts: number
          delivery_error: string | null
          delivery_status: string
          discount_amount: number
          failed_reason: string | null
          id: string
          keys_viewed_at: string | null
          last_delivery_attempt_at: string | null
          last_reconciled_at: string | null
          leekpay_payload: Json | null
          matching_details: Json | null
          metadata: Json
          paid_at: string | null
          payment_id: string | null
          payment_mode: string | null
          payment_url: string | null
          promo_code: string | null
          provider: string
          reference: string
          refunded_at: string | null
          reminder_sent_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_amount: number | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          customer_email: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_attempts?: number
          delivery_error?: string | null
          delivery_status?: string
          discount_amount?: number
          failed_reason?: string | null
          id?: string
          keys_viewed_at?: string | null
          last_delivery_attempt_at?: string | null
          last_reconciled_at?: string | null
          leekpay_payload?: Json | null
          matching_details?: Json | null
          metadata?: Json
          paid_at?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          payment_url?: string | null
          promo_code?: string | null
          provider?: string
          reference?: string
          refunded_at?: string | null
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          customer_email?: string
          customer_name?: string | null
          customer_phone?: string | null
          delivery_attempts?: number
          delivery_error?: string | null
          delivery_status?: string
          discount_amount?: number
          failed_reason?: string | null
          id?: string
          keys_viewed_at?: string | null
          last_delivery_attempt_at?: string | null
          last_reconciled_at?: string | null
          leekpay_payload?: Json | null
          matching_details?: Json | null
          metadata?: Json
          paid_at?: string | null
          payment_id?: string | null
          payment_mode?: string | null
          payment_url?: string | null
          promo_code?: string | null
          provider?: string
          reference?: string
          refunded_at?: string | null
          reminder_sent_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_provider_settings: {
        Row: {
          credentials_ciphertext: string | null
          enabled: boolean
          mode: string
          provider: string
          updated_at: string
        }
        Insert: {
          credentials_ciphertext?: string | null
          enabled?: boolean
          mode?: string
          provider: string
          updated_at?: string
        }
        Update: {
          credentials_ciphertext?: string | null
          enabled?: boolean
          mode?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_tiers: {
        Row: {
          created_at: string
          display_order: number
          duration: string
          id: string
          is_active: boolean
          label: string
          old_price: number | null
          price: number
          product_id: string
          stock: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          duration: string
          id?: string
          is_active?: boolean
          label: string
          old_price?: number | null
          price: number
          product_id: string
          stock?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          duration?: string
          id?: string
          is_active?: boolean
          label?: string
          old_price?: number | null
          price?: number
          product_id?: string
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tiers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_stock"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          cost_usd: number | null
          created_at: string
          description: string
          digitrust_id: string | null
          display_order: number
          duration: string | null
          featured: boolean
          id: string
          image_url: string | null
          instant_delivery: boolean
          is_active: boolean
          name: string
          old_price: number | null
          price: number
          primestore_id: string | null
          promo: boolean
          promo_end_at: string | null
          promo_start_at: string | null
          slug: string
          source: string
          supplier_id: string | null
          stock: number
          type: string
          updated_at: string
        }
        Insert: {
          category?: string
          cost_usd?: number | null
          created_at?: string
          description?: string
          digitrust_id?: string | null
          display_order?: number
          duration?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          instant_delivery?: boolean
          is_active?: boolean
          name: string
          old_price?: number | null
          price: number
          primestore_id?: string | null
          promo?: boolean
          promo_end_at?: string | null
          promo_start_at?: string | null
          slug: string
          source?: string
          supplier_id?: string | null
          stock?: number
          type?: string
          updated_at?: string
        }
        Update: {
          category?: string
          cost_usd?: number | null
          created_at?: string
          description?: string
          digitrust_id?: string | null
          display_order?: number
          duration?: string | null
          featured?: boolean
          id?: string
          image_url?: string | null
          instant_delivery?: boolean
          is_active?: boolean
          name?: string
          old_price?: number | null
          price?: number
          primestore_id?: string | null
          promo?: boolean
          promo_end_at?: string | null
          promo_start_at?: string | null
          slug?: string
          source?: string
          supplier_id?: string | null
          stock?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["promo_kind"]
          max_uses: number | null
          min_order_amount: number
          starts_at: string | null
          updated_at: string
          uses_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promo_kind"]
          max_uses?: number | null
          min_order_amount?: number
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["promo_kind"]
          max_uses?: number | null
          min_order_amount?: number
          starts_at?: string | null
          updated_at?: string
          uses_count?: number
          value?: number
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      products_with_stock: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          duration: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          name: string | null
          old_price: number | null
          price: number | null
          promo: boolean | null
          slug: string | null
          stock: number | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_paid_order_keys: {
        Args: { _order_id: string; _product_id: string; _quantity: number }
        Returns: boolean
      }
      claim_digitrust_purchase: { Args: { _item_id: string }; Returns: boolean }
      claim_paydunya_order: { Args: { _order_id: string }; Returns: boolean }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_order_with_keys: { Args: { p_order_id: string }; Returns: Json }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      mark_keys_viewed: { Args: { p_order_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      record_digitrust_delivery: {
        Args: {
          _contents: string[]
          _item_id: string
          _supplier_order_id: string
        }
        Returns: boolean
      }
      validate_promo_code: {
        Args: { _code: string; _subtotal: number }
        Returns: Json
      }
    }
    Enums: {
      app_role: "super_admin" | "manager" | "support"
      license_status: "available" | "reserved" | "sold"
      order_status: "pending" | "paid" | "failed" | "expired" | "refunded"
      promo_kind: "percent" | "amount"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["super_admin", "manager", "support"],
      license_status: ["available", "reserved", "sold"],
      order_status: ["pending", "paid", "failed", "expired", "refunded"],
      promo_kind: ["percent", "amount"],
    },
  },
} as const
