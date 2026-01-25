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
      dry_ice_orders: {
        Row: {
          assigned_to: string | null
          box_count: number | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          id: string
          notes: string | null
          order_number: string
          packaging_id: string | null
          product_type: Database["public"]["Enums"]["dry_ice_product_type"]
          product_type_id: string | null
          quantity_kg: number
          scheduled_date: string
          status: Database["public"]["Enums"]["production_order_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          box_count?: number | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          id?: string
          notes?: string | null
          order_number: string
          packaging_id?: string | null
          product_type?: Database["public"]["Enums"]["dry_ice_product_type"]
          product_type_id?: string | null
          quantity_kg: number
          scheduled_date: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          box_count?: number | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          id?: string
          notes?: string | null
          order_number?: string
          packaging_id?: string | null
          product_type?: Database["public"]["Enums"]["dry_ice_product_type"]
          product_type_id?: string | null
          quantity_kg?: number
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
            foreignKeyName: "dry_ice_orders_packaging_id_fkey"
            columns: ["packaging_id"]
            isOneToOne: false
            referencedRelation: "dry_ice_packaging"
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
      gas_cylinder_orders: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          customer_name: string
          cylinder_count: number
          cylinder_size: string
          gas_type: Database["public"]["Enums"]["gas_type"]
          id: string
          notes: string | null
          order_number: string
          scheduled_date: string
          status: Database["public"]["Enums"]["production_order_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          customer_name: string
          cylinder_count: number
          cylinder_size?: string
          gas_type?: Database["public"]["Enums"]["gas_type"]
          id?: string
          notes?: string | null
          order_number: string
          scheduled_date: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          customer_name?: string
          cylinder_count?: number
          cylinder_size?: string
          gas_type?: Database["public"]["Enums"]["gas_type"]
          id?: string
          notes?: string | null
          order_number?: string
          scheduled_date?: string
          status?: Database["public"]["Enums"]["production_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gas_cylinder_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_cylinder_orders_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_cylinder_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_cylinder_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_limited"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gas_cylinder_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
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
      profiles: {
        Row: {
          address: string | null
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
          job_title: string | null
          location: string | null
          manager_id: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
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
          job_title?: string | null
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
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
          job_title?: string | null
          location?: string | null
          manager_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
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
      profiles_limited: {
        Row: {
          department: string | null
          email: string | null
          full_name: string | null
          id: string | null
          job_title: string | null
          user_id: string | null
        }
        Insert: {
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          job_title?: string | null
          user_id?: string | null
        }
        Update: {
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          job_title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      dry_ice_product_type: "blocks" | "pellets" | "sticks"
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
      app_role: ["admin", "user"],
      dry_ice_product_type: ["blocks", "pellets", "sticks"],
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
