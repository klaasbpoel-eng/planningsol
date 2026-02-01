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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      customer_products: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          product_id: string
          warehouse: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          product_id: string
          warehouse?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          product_id?: string
          warehouse?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cylinder_sizes: {
        Row: {
          capacity_liters: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          capacity_liters?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capacity_liters?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dry_ice_orders: {
        Row: {
          assigned_to: string | null
          box_count: number | null
          container_has_wheels: boolean | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          id: string
          is_recurring: boolean | null
          notes: string | null
          order_number: string
          packaging_id: string | null
          parent_order_id: string | null
          product_type: Database["public"]["Enums"]["dry_ice_product_type"]
          product_type_id: string | null
          quantity_kg: number
          recurrence_end_date: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["production_order_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          box_count?: number | null
          container_has_wheels?: boolean | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          order_number: string
          packaging_id?: string | null
          parent_order_id?: string | null
          product_type?: Database["public"]["Enums"]["dry_ice_product_type"]
          product_type_id?: string | null
          quantity_kg: number
          recurrence_end_date?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          box_count?: number | null
          container_has_wheels?: boolean | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          is_recurring?: boolean | null
          notes?: string | null
          order_number?: string
          packaging_id?: string | null
          parent_order_id?: string | null
          product_type?: Database["public"]["Enums"]["dry_ice_product_type"]
          product_type_id?: string | null
          quantity_kg?: number
          recurrence_end_date?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dry_ice_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "dry_ice_packaging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "dry_ice_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dry_ice_orders_product_type_id_fkey"
            columns: ["product_type_id"]
            isOneToOne: false
            referencedRelation: "dry_ice_product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      dry_ice_packaging: {
        Row: {
          capacity_kg: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          capacity_kg?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          capacity_kg?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dry_ice_product_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      employee_leave_balances: {
        Row: {
          accrual_rate: number | null
          annual_allowance: number
          carried_over: number
          created_at: string
          id: string
          type_id: string
          updated_at: string
          used_days: number
          user_id: string
          year: number
        }
        Insert: {
          accrual_rate?: number | null
          annual_allowance?: number
          carried_over?: number
          created_at?: string
          id?: string
          type_id: string
          updated_at?: string
          used_days?: number
          user_id: string
          year?: number
        }
        Update: {
          accrual_rate?: number | null
          annual_allowance?: number
          carried_over?: number
          created_at?: string
          id?: string
          type_id?: string
          updated_at?: string
          used_days?: number
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_balances_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "time_off_types"
            referencedColumns: ["id"]
          },
        ]
      }
      gas_types: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          article_code: string
          created_at: string
          id: string
          notes: string | null
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          article_code: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
        }
        Update: {
          article_code?: string
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
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
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          delivery_date: string | null
          id: string
          notes: string | null
          order_number: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          article_code: string
          category: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          size_liters: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          article_code: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          size_liters?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          article_code?: string
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          size_liters?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date_of_birth: string | null
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employment_type: string | null
          full_name: string | null
          hire_date: string | null
          id: string
          intended_role: string | null
          is_approved: boolean
          job_title: string | null
          location: string | null
          manager_id: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          intended_role?: string | null
          is_approved?: boolean
          job_title?: string | null
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employment_type?: string | null
          full_name?: string | null
          hire_date?: string | null
          id?: string
          intended_role?: string | null
          is_approved?: boolean
          job_title?: string | null
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
        ]
      }
      task_types: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_types_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          due_date: string
          end_time: string | null
          id: string
          priority: string
          start_time: string | null
          status: string
          type_id: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          due_date: string
          end_time?: string | null
          id?: string
          priority?: string
          start_time?: string | null
          status?: string
          type_id?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          end_time?: string | null
          id?: string
          priority?: string
          start_time?: string | null
          status?: string
          type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "task_types"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          created_at: string
          day_part: string | null
          end_date: string
          id: string
          profile_id: string
          reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["request_status"]
          type: Database["public"]["Enums"]["time_off_type"]
          type_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          day_part?: string | null
          end_date: string
          id?: string
          profile_id: string
          reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["request_status"]
          type?: Database["public"]["Enums"]["time_off_type"]
          type_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          day_part?: string | null
          end_date?: string
          id?: string
          profile_id?: string
          reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["request_status"]
          type?: Database["public"]["Enums"]["time_off_type"]
          type_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_requests_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "time_off_types"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_types: {
        Row: {
          color: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      customers_limited: {
        Row: {
          id: string | null
          is_active: boolean | null
          name: string | null
        }
        Insert: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Update: {
          id?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
      profiles_limited: {
        Row: {
          department: string | null
          full_name: string | null
          id: string | null
          job_title: string | null
          user_id: string | null
        }
        Insert: {
          department?: string | null
          full_name?: string | null
          id?: string | null
          job_title?: string | null
          user_id?: string | null
        }
        Update: {
          department?: string | null
          full_name?: string | null
          id?: string | null
          job_title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bulk_delete_orders_by_year: {
        Args: { p_order_type: string; p_year: number }
        Returns: number
      }
      get_monthly_cylinder_totals_by_gas_type: {
        Args: { p_year: number }
        Returns: {
          gas_type_color: string
          gas_type_id: string
          gas_type_name: string
          month: number
          total_cylinders: number
        }[]
      }
      get_monthly_order_totals: {
        Args: { p_order_type: string; p_year: number }
        Returns: {
          month: number
          total_value: number
        }[]
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_yearly_totals_by_customer: {
        Args: { p_year: number }
        Returns: {
          customer_id: string
          customer_name: string
          total_cylinders: number
          total_dry_ice_kg: number
        }[]
      }
      has_elevated_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_user_approved: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "operator" | "supervisor"
      dry_ice_product_type: "blocks" | "pellets" | "sticks"
      gas_grade: "medical" | "technical"
      gas_type:
        | "co2"
        | "nitrogen"
        | "argon"
        | "acetylene"
        | "oxygen"
        | "helium"
        | "other"
      production_order_status:
        | "pending"
        | "in_progress"
        | "completed"
        | "cancelled"
      request_status: "pending" | "approved" | "rejected"
      time_off_type: "vacation" | "sick" | "personal" | "other"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin", "user", "operator", "supervisor"],
      dry_ice_product_type: ["blocks", "pellets", "sticks"],
      gas_grade: ["medical", "technical"],
      gas_type: [
        "co2",
        "nitrogen",
        "argon",
        "acetylene",
        "oxygen",
        "helium",
        "other",
      ],
      production_order_status: [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
      ],
      request_status: ["pending", "approved", "rejected"],
      time_off_type: ["vacation", "sick", "personal", "other"],
    },
  },
} as const
