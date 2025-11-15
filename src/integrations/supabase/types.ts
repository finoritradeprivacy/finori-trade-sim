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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_type: string
          category: string
          created_at: string
          current_price: number
          description: string | null
          id: string
          is_active: boolean | null
          market_cap: number | null
          name: string
          price_change_24h: number | null
          symbol: string
          updated_at: string
          volume_24h: number | null
        }
        Insert: {
          asset_type?: string
          category?: string
          created_at?: string
          current_price: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          market_cap?: number | null
          name: string
          price_change_24h?: number | null
          symbol: string
          updated_at?: string
          volume_24h?: number | null
        }
        Update: {
          asset_type?: string
          category?: string
          created_at?: string
          current_price?: number
          description?: string | null
          id?: string
          is_active?: boolean | null
          market_cap?: number | null
          name?: string
          price_change_24h?: number | null
          symbol?: string
          updated_at?: string
          volume_24h?: number | null
        }
        Relationships: []
      }
      challenges: {
        Row: {
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          created_at: string
          description: string
          id: string
          reward_usdt: number
          reward_xp: number
          target_value: number
          title: string
        }
        Insert: {
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          created_at?: string
          description: string
          id?: string
          reward_usdt: number
          reward_xp: number
          target_value?: number
          title: string
        }
        Update: {
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          created_at?: string
          description?: string
          id?: string
          reward_usdt?: number
          reward_xp?: number
          target_value?: number
          title?: string
        }
        Relationships: []
      }
      daily_challenges: {
        Row: {
          challenge_date: string
          challenge_id: string
          created_at: string
          id: string
        }
        Insert: {
          challenge_date: string
          challenge_id: string
          created_at?: string
          id?: string
        }
        Update: {
          challenge_date?: string
          challenge_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      news_events: {
        Row: {
          asset_id: string | null
          content: string
          created_at: string
          event_type: string
          headline: string
          id: string
          impact_strength: number
          impact_type: string
          original_price: number | null
          reversion_complete_at: string | null
          scheduled_for: string | null
        }
        Insert: {
          asset_id?: string | null
          content: string
          created_at?: string
          event_type: string
          headline: string
          id?: string
          impact_strength?: number
          impact_type: string
          original_price?: number | null
          reversion_complete_at?: string | null
          scheduled_for?: string | null
        }
        Update: {
          asset_id?: string | null
          content?: string
          created_at?: string
          event_type?: string
          headline?: string
          id?: string
          impact_strength?: number
          impact_type?: string
          original_price?: number | null
          reversion_complete_at?: string | null
          scheduled_for?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "news_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          asset_id: string
          average_fill_price: number | null
          created_at: string
          filled_at: string | null
          filled_quantity: number | null
          id: string
          order_subtype: string | null
          order_type: string
          price: number | null
          quantity: number
          side: string
          status: string
          stop_price: number | null
          time_in_force: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          average_fill_price?: number | null
          created_at?: string
          filled_at?: string | null
          filled_quantity?: number | null
          id?: string
          order_subtype?: string | null
          order_type: string
          price?: number | null
          quantity: number
          side: string
          status?: string
          stop_price?: number | null
          time_in_force?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          average_fill_price?: number | null
          created_at?: string
          filled_at?: string | null
          filled_quantity?: number | null
          id?: string
          order_subtype?: string | null
          order_type?: string
          price?: number | null
          quantity?: number
          side?: string
          status?: string
          stop_price?: number | null
          time_in_force?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_stats: {
        Row: {
          achievements: Json | null
          created_at: string
          id: string
          level: number | null
          total_xp: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          achievements?: Json | null
          created_at?: string
          id?: string
          level?: number | null
          total_xp?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          achievements?: Json | null
          created_at?: string
          id?: string
          level?: number | null
          total_xp?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      portfolios: {
        Row: {
          asset_id: string
          average_buy_price: number
          created_at: string
          id: string
          quantity: number
          total_invested: number
          unrealized_pnl: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_id: string
          average_buy_price?: number
          created_at?: string
          id?: string
          quantity?: number
          total_invested?: number
          unrealized_pnl?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_id?: string
          average_buy_price?: number
          created_at?: string
          id?: string
          quantity?: number
          total_invested?: number
          unrealized_pnl?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolios_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portfolios_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_history: {
        Row: {
          asset_id: string
          close: number
          created_at: string
          high: number
          id: string
          low: number
          open: number
          time: number
        }
        Insert: {
          asset_id: string
          close: number
          created_at?: string
          high: number
          id?: string
          low: number
          open: number
          time: number
        }
        Update: {
          asset_id?: string
          close?: number
          created_at?: string
          high?: number
          id?: string
          low?: number
          open?: number
          time?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          id: string
          last_active_at: string | null
          nickname: string
          played_time_seconds: number | null
          total_profit_loss: number | null
          total_trades: number | null
          win_rate: number | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          id: string
          last_active_at?: string | null
          nickname: string
          played_time_seconds?: number | null
          total_profit_loss?: number | null
          total_trades?: number | null
          win_rate?: number | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          id?: string
          last_active_at?: string | null
          nickname?: string
          played_time_seconds?: number | null
          total_profit_loss?: number | null
          total_trades?: number | null
          win_rate?: number | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      trades: {
        Row: {
          asset_id: string
          created_at: string
          fee: number | null
          id: string
          order_id: string
          price: number
          quantity: number
          realized_pnl: number | null
          side: string
          total_value: number
          user_id: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          fee?: number | null
          id?: string
          order_id: string
          price: number
          quantity: number
          realized_pnl?: number | null
          side: string
          total_value: number
          user_id: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          fee?: number | null
          id?: string
          order_id?: string
          price?: number
          quantity?: number
          realized_pnl?: number | null
          side?: string
          total_value?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trades_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_balances: {
        Row: {
          created_at: string
          locked_balance: number | null
          updated_at: string
          usdt_balance: number
          user_id: string
        }
        Insert: {
          created_at?: string
          locked_balance?: number | null
          updated_at?: string
          usdt_balance?: number
          user_id: string
        }
        Update: {
          created_at?: string
          locked_balance?: number | null
          updated_at?: string
          usdt_balance?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_balances_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenge_progress: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          current_value: number
          daily_challenge_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          daily_challenge_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          current_value?: number
          daily_challenge_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_challenge_progress_daily_challenge_id_fkey"
            columns: ["daily_challenge_id"]
            isOneToOne: false
            referencedRelation: "daily_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_daily_streak: {
        Row: {
          created_at: string
          current_streak: number
          last_login_date: string
          streak_history: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          last_login_date: string
          streak_history?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          last_login_date?: string
          streak_history?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_total_xp_for_level: {
        Args: { target_level: number }
        Returns: number
      }
      calculate_xp_for_level: {
        Args: { target_level: number }
        Returns: number
      }
      get_config: { Args: { p_key: string }; Returns: string }
      increment_balance: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      increment_xp: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      process_market_order: {
        Args: {
          p_asset_id: string
          p_price: number
          p_quantity: number
          p_side: string
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      challenge_type:
        | "trades_count"
        | "profit_percentage"
        | "portfolio_diversity"
        | "consecutive_profits"
        | "small_loss"
        | "trend_lines"
        | "loss_then_profit"
        | "news_reactions"
        | "night_trade"
        | "portfolio_size"
        | "trade_value"
        | "trades_in_hour"
        | "holding_time"
        | "multi_market"
        | "timeframe_views"
        | "chart_note"
        | "active_time"
        | "quick_profit"
        | "news_trade"
        | "quick_trades"
        | "daily_xp"
        | "no_losses"
        | "timeframe_changes"
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
      challenge_type: [
        "trades_count",
        "profit_percentage",
        "portfolio_diversity",
        "consecutive_profits",
        "small_loss",
        "trend_lines",
        "loss_then_profit",
        "news_reactions",
        "night_trade",
        "portfolio_size",
        "trade_value",
        "trades_in_hour",
        "holding_time",
        "multi_market",
        "timeframe_views",
        "chart_note",
        "active_time",
        "quick_profit",
        "news_trade",
        "quick_trades",
        "daily_xp",
        "no_losses",
        "timeframe_changes",
      ],
    },
  },
} as const
