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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      model_equipment: {
        Row: {
          comments: string | null
          count: number | null
          dept_code: string | null
          eq1: number | null
          eq2: number | null
          eq3: number | null
          eq4: number | null
          equip_type: string | null
          id: string
          labor_group_id: string | null
          model_id: string
          mttf: number | null
          mttr: number | null
          name: string
          overtime_pct: number | null
          run_factor: number | null
          setup_factor: number | null
          var_factor: number | null
        }
        Insert: {
          comments?: string | null
          count?: number | null
          dept_code?: string | null
          eq1?: number | null
          eq2?: number | null
          eq3?: number | null
          eq4?: number | null
          equip_type?: string | null
          id?: string
          labor_group_id?: string | null
          model_id: string
          mttf?: number | null
          mttr?: number | null
          name: string
          overtime_pct?: number | null
          run_factor?: number | null
          setup_factor?: number | null
          var_factor?: number | null
        }
        Update: {
          comments?: string | null
          count?: number | null
          dept_code?: string | null
          eq1?: number | null
          eq2?: number | null
          eq3?: number | null
          eq4?: number | null
          equip_type?: string | null
          id?: string
          labor_group_id?: string | null
          model_id?: string
          mttf?: number | null
          mttr?: number | null
          name?: string
          overtime_pct?: number | null
          run_factor?: number | null
          setup_factor?: number | null
          var_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_equipment_labor_group_id_fkey"
            columns: ["labor_group_id"]
            isOneToOne: false
            referencedRelation: "model_labor"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_equipment_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_families: {
        Row: {
          id: string
          model_id: string
          name: string
          template_string: string | null
        }
        Insert: {
          id?: string
          model_id: string
          name: string
          template_string?: string | null
        }
        Update: {
          id?: string
          model_id?: string
          name?: string
          template_string?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_families_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_general: {
        Row: {
          author: string | null
          comments: string | null
          comments_date: string | null
          conv1: number | null
          conv2: number | null
          gen1: number | null
          gen2: number | null
          gen3: number | null
          gen4: number | null
          mct_time_unit: string | null
          model_id: string
          model_title: string | null
          ops_time_unit: string | null
          prod_period_unit: string | null
          util_limit: number | null
          var_equip: number | null
          var_labor: number | null
          var_prod: number | null
        }
        Insert: {
          author?: string | null
          comments?: string | null
          comments_date?: string | null
          conv1?: number | null
          conv2?: number | null
          gen1?: number | null
          gen2?: number | null
          gen3?: number | null
          gen4?: number | null
          mct_time_unit?: string | null
          model_id: string
          model_title?: string | null
          ops_time_unit?: string | null
          prod_period_unit?: string | null
          util_limit?: number | null
          var_equip?: number | null
          var_labor?: number | null
          var_prod?: number | null
        }
        Update: {
          author?: string | null
          comments?: string | null
          comments_date?: string | null
          conv1?: number | null
          conv2?: number | null
          gen1?: number | null
          gen2?: number | null
          gen3?: number | null
          gen4?: number | null
          mct_time_unit?: string | null
          model_id?: string
          model_title?: string | null
          ops_time_unit?: string | null
          prod_period_unit?: string | null
          util_limit?: number | null
          var_equip?: number | null
          var_labor?: number | null
          var_prod?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_general_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_ibom: {
        Row: {
          component_product_id: string
          id: string
          model_id: string
          parent_product_id: string
          units_per_assy: number | null
        }
        Insert: {
          component_product_id: string
          id?: string
          model_id: string
          parent_product_id: string
          units_per_assy?: number | null
        }
        Update: {
          component_product_id?: string
          id?: string
          model_id?: string
          parent_product_id?: string
          units_per_assy?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_ibom_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "model_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_ibom_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_ibom_parent_product_id_fkey"
            columns: ["parent_product_id"]
            isOneToOne: false
            referencedRelation: "model_products"
            referencedColumns: ["id"]
          },
        ]
      }
      model_labor: {
        Row: {
          comments: string | null
          count: number | null
          dept_code: string | null
          id: string
          lab1: number | null
          lab2: number | null
          lab3: number | null
          lab4: number | null
          model_id: string
          name: string
          overtime_pct: number | null
          prioritize_use: boolean | null
          run_factor: number | null
          setup_factor: number | null
          unavail_pct: number | null
          var_factor: number | null
        }
        Insert: {
          comments?: string | null
          count?: number | null
          dept_code?: string | null
          id?: string
          lab1?: number | null
          lab2?: number | null
          lab3?: number | null
          lab4?: number | null
          model_id: string
          name: string
          overtime_pct?: number | null
          prioritize_use?: boolean | null
          run_factor?: number | null
          setup_factor?: number | null
          unavail_pct?: number | null
          var_factor?: number | null
        }
        Update: {
          comments?: string | null
          count?: number | null
          dept_code?: string | null
          id?: string
          lab1?: number | null
          lab2?: number | null
          lab3?: number | null
          lab4?: number | null
          model_id?: string
          name?: string
          overtime_pct?: number | null
          prioritize_use?: boolean | null
          run_factor?: number | null
          setup_factor?: number | null
          unavail_pct?: number | null
          var_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_labor_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_operations: {
        Row: {
          equip_id: string | null
          equip_run_lot: number | null
          equip_run_piece: number | null
          equip_run_tbatch: number | null
          equip_setup_lot: number | null
          equip_setup_piece: number | null
          equip_setup_tbatch: number | null
          id: string
          labor_run_lot: number | null
          labor_run_piece: number | null
          labor_run_tbatch: number | null
          labor_setup_lot: number | null
          labor_setup_piece: number | null
          labor_setup_tbatch: number | null
          model_id: string
          op_name: string
          op_number: number | null
          oper1: number | null
          oper2: number | null
          oper3: number | null
          oper4: number | null
          pct_assigned: number | null
          product_id: string
        }
        Insert: {
          equip_id?: string | null
          equip_run_lot?: number | null
          equip_run_piece?: number | null
          equip_run_tbatch?: number | null
          equip_setup_lot?: number | null
          equip_setup_piece?: number | null
          equip_setup_tbatch?: number | null
          id?: string
          labor_run_lot?: number | null
          labor_run_piece?: number | null
          labor_run_tbatch?: number | null
          labor_setup_lot?: number | null
          labor_setup_piece?: number | null
          labor_setup_tbatch?: number | null
          model_id: string
          op_name: string
          op_number?: number | null
          oper1?: number | null
          oper2?: number | null
          oper3?: number | null
          oper4?: number | null
          pct_assigned?: number | null
          product_id: string
        }
        Update: {
          equip_id?: string | null
          equip_run_lot?: number | null
          equip_run_piece?: number | null
          equip_run_tbatch?: number | null
          equip_setup_lot?: number | null
          equip_setup_piece?: number | null
          equip_setup_tbatch?: number | null
          id?: string
          labor_run_lot?: number | null
          labor_run_piece?: number | null
          labor_run_tbatch?: number | null
          labor_setup_lot?: number | null
          labor_setup_piece?: number | null
          labor_setup_tbatch?: number | null
          model_id?: string
          op_name?: string
          op_number?: number | null
          oper1?: number | null
          oper2?: number | null
          oper3?: number | null
          oper4?: number | null
          pct_assigned?: number | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_operations_equip_id_fkey"
            columns: ["equip_id"]
            isOneToOne: false
            referencedRelation: "model_equipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_operations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_operations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "model_products"
            referencedColumns: ["id"]
          },
        ]
      }
      model_param_names: {
        Row: {
          eq1_name: string | null
          eq2_name: string | null
          eq3_name: string | null
          eq4_name: string | null
          gen1_name: string | null
          gen2_name: string | null
          gen3_name: string | null
          gen4_name: string | null
          lab1_name: string | null
          lab2_name: string | null
          lab3_name: string | null
          lab4_name: string | null
          model_id: string
          oper1_name: string | null
          oper2_name: string | null
          oper3_name: string | null
          oper4_name: string | null
          prod1_name: string | null
          prod2_name: string | null
          prod3_name: string | null
          prod4_name: string | null
        }
        Insert: {
          eq1_name?: string | null
          eq2_name?: string | null
          eq3_name?: string | null
          eq4_name?: string | null
          gen1_name?: string | null
          gen2_name?: string | null
          gen3_name?: string | null
          gen4_name?: string | null
          lab1_name?: string | null
          lab2_name?: string | null
          lab3_name?: string | null
          lab4_name?: string | null
          model_id: string
          oper1_name?: string | null
          oper2_name?: string | null
          oper3_name?: string | null
          oper4_name?: string | null
          prod1_name?: string | null
          prod2_name?: string | null
          prod3_name?: string | null
          prod4_name?: string | null
        }
        Update: {
          eq1_name?: string | null
          eq2_name?: string | null
          eq3_name?: string | null
          eq4_name?: string | null
          gen1_name?: string | null
          gen2_name?: string | null
          gen3_name?: string | null
          gen4_name?: string | null
          lab1_name?: string | null
          lab2_name?: string | null
          lab3_name?: string | null
          lab4_name?: string | null
          model_id?: string
          oper1_name?: string | null
          oper2_name?: string | null
          oper3_name?: string | null
          oper4_name?: string | null
          prod1_name?: string | null
          prod2_name?: string | null
          prod3_name?: string | null
          prod4_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_param_names_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_products: {
        Row: {
          comments: string | null
          demand: number | null
          demand_factor: number | null
          gather_tbatches: boolean | null
          id: string
          lot_factor: number | null
          lot_size: number | null
          make_to_stock: boolean | null
          model_id: string
          name: string
          prod1: number | null
          prod2: number | null
          prod3: number | null
          prod4: number | null
          tbatch_size: number | null
          var_factor: number | null
        }
        Insert: {
          comments?: string | null
          demand?: number | null
          demand_factor?: number | null
          gather_tbatches?: boolean | null
          id?: string
          lot_factor?: number | null
          lot_size?: number | null
          make_to_stock?: boolean | null
          model_id: string
          name: string
          prod1?: number | null
          prod2?: number | null
          prod3?: number | null
          prod4?: number | null
          tbatch_size?: number | null
          var_factor?: number | null
        }
        Update: {
          comments?: string | null
          demand?: number | null
          demand_factor?: number | null
          gather_tbatches?: boolean | null
          id?: string
          lot_factor?: number | null
          lot_size?: number | null
          make_to_stock?: boolean | null
          model_id?: string
          name?: string
          prod1?: number | null
          prod2?: number | null
          prod3?: number | null
          prod4?: number | null
          tbatch_size?: number | null
          var_factor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "model_products_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_routing: {
        Row: {
          from_op_id: string
          id: string
          model_id: string
          pct_routed: number
          product_id: string
          to_op_name: string
        }
        Insert: {
          from_op_id: string
          id?: string
          model_id: string
          pct_routed: number
          product_id: string
          to_op_name: string
        }
        Update: {
          from_op_id?: string
          id?: string
          model_id?: string
          pct_routed?: number
          product_id?: string
          to_op_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_routing_from_op_id_fkey"
            columns: ["from_op_id"]
            isOneToOne: false
            referencedRelation: "model_operations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_routing_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_routing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "model_products"
            referencedColumns: ["id"]
          },
        ]
      }
      model_scenario_changes: {
        Row: {
          basecase_value: string | null
          data_type: string
          entity_id: string | null
          entity_name: string | null
          field_name: string
          id: string
          scenario_id: string
          whatif_value: string | null
        }
        Insert: {
          basecase_value?: string | null
          data_type: string
          entity_id?: string | null
          entity_name?: string | null
          field_name: string
          id?: string
          scenario_id: string
          whatif_value?: string | null
        }
        Update: {
          basecase_value?: string | null
          data_type?: string
          entity_id?: string | null
          entity_name?: string | null
          field_name?: string
          id?: string
          scenario_id?: string
          whatif_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_scenario_changes_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "model_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      model_scenario_results: {
        Row: {
          calculated_at: string | null
          id: string
          result_data: Json | null
          result_type: string | null
          scenario_id: string
        }
        Insert: {
          calculated_at?: string | null
          id?: string
          result_data?: Json | null
          result_type?: string | null
          scenario_id: string
        }
        Update: {
          calculated_at?: string | null
          id?: string
          result_data?: Json | null
          result_type?: string | null
          scenario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_scenario_results_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "model_scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      model_scenarios: {
        Row: {
          created_at: string | null
          description: string | null
          family_id: string | null
          id: string
          is_basecase: boolean | null
          model_id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          family_id?: string | null
          id?: string
          is_basecase?: boolean | null
          model_id: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          family_id?: string | null
          id?: string
          is_basecase?: boolean | null
          model_id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "model_scenarios_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "model_families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_scenarios_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      model_versions: {
        Row: {
          created_at: string
          id: string
          label: string
          model_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string
          model_id: string
          snapshot: Json
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          model_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "model_versions_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "models"
            referencedColumns: ["id"]
          },
        ]
      }
      models: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          is_demo: boolean | null
          last_run_at: string | null
          name: string
          org_id: string
          run_status: string | null
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_demo?: boolean | null
          last_run_at?: string | null
          name: string
          org_id: string
          run_status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          is_demo?: boolean | null
          last_run_at?: string | null
          name?: string
          org_id?: string
          run_status?: string | null
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "models_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "models_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          org_id: string | null
          role: string | null
          user_level: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          org_id?: string | null
          role?: string | null
          user_level?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          org_id?: string | null
          role?: string | null
          user_level?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_org_id: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
