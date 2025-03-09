export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      agent_responses: {
        Row: {
          confidence: number
          created_at: string | null
          id: string
          metadata: Json | null
          model_used: string
          prompt: string
          response: string
          task_id: string
          updated_at: string | null
        }
        Insert: {
          confidence: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model_used: string
          prompt: string
          response: string
          task_id: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          model_used?: string
          prompt?: string
          response?: string
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_responses_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_statuses: {
        Row: {
          agent_type: string
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          progress: number | null
          project_id: string
          status: string
          updated_at: string
        }
        Insert: {
          agent_type: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          progress?: number | null
          project_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          agent_type?: string
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          progress?: number | null
          project_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          code_language: string | null
          content: string
          created_at: string
          id: string
          project_id: string
          sender: string
          type: string
        }
        Insert: {
          code_language?: string | null
          content: string
          created_at?: string
          id?: string
          project_id: string
          sender: string
          type?: string
        }
        Update: {
          code_language?: string | null
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          sender?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      code_files: {
        Row: {
          content: string
          created_at: string
          created_by: string
          id: string
          language: string | null
          last_modified_by: string
          name: string
          path: string
          project_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          id?: string
          language?: string | null
          last_modified_by: string
          name: string
          path: string
          project_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          language?: string | null
          last_modified_by?: string
          name?: string
          path?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      collaboration_sessions: {
        Row: {
          created_at: string | null
          end_time: string | null
          id: string
          primary_agent_id: string
          start_time: string
          status: string
          supporting_agent_ids: string[]
          task_context: Json
          task_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          primary_agent_id: string
          start_time: string
          status: string
          supporting_agent_ids: string[]
          task_context: Json
          task_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          id?: string
          primary_agent_id?: string
          start_time?: string
          status?: string
          supporting_agent_ids?: string[]
          task_context?: Json
          task_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_function_status: {
        Row: {
          created_at: string | null
          error: string | null
          function_name: string
          id: string
          last_check: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          function_name: string
          id?: string
          last_check?: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          function_name?: string
          id?: string
          last_check?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      embeddings: {
        Row: {
          content: string
          created_at: string | null
          embedding: string
          id: string
          metadata: Json | null
          project_id: string | null
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          embedding: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          embedding?: string
          id?: string
          metadata?: Json | null
          project_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "embeddings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          progress: number | null
          requirements: string | null
          source_type: string | null
          source_url: string | null
          status: string
          tech_stack: string[] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          progress?: number | null
          requirements?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          tech_stack?: string[] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          progress?: number | null
          requirements?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: string
          tech_stack?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          agent_id: string | null
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          dependencies: string[] | null
          description: string | null
          id: string
          metadata: Json | null
          priority: string
          project_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          project_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent_id?: string | null
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          dependencies?: string[] | null
          description?: string | null
          id?: string
          metadata?: Json | null
          priority?: string
          project_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize:
        | {
            Args: {
              "": string
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      halfvec_avg: {
        Args: {
          "": number[]
        }
        Returns: unknown
      }
      halfvec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      halfvec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      halfvec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      hnsw_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnsw_sparsevec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      hnswhandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_bit_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflat_halfvec_support: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      ivfflathandler: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      l2_norm:
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      l2_normalize:
        | {
            Args: {
              "": string
            }
            Returns: string
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
        | {
            Args: {
              "": unknown
            }
            Returns: unknown
          }
      match_embeddings:
        | {
            Args: {
              query_embedding: string
              match_threshold: number
              match_count: number
              project_filter: string
            }
            Returns: {
              id: string
              content: string
              metadata: Json
              similarity: number
            }[]
          }
        | {
            Args: {
              query_embedding: string
              match_threshold: number
              match_count: number
              project_filter: string
            }
            Returns: {
              id: string
              content: string
              metadata: Json
              similarity: number
            }[]
          }
      sparsevec_out: {
        Args: {
          "": unknown
        }
        Returns: unknown
      }
      sparsevec_send: {
        Args: {
          "": unknown
        }
        Returns: string
      }
      sparsevec_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
      vector_avg: {
        Args: {
          "": number[]
        }
        Returns: string
      }
      vector_dims:
        | {
            Args: {
              "": string
            }
            Returns: number
          }
        | {
            Args: {
              "": unknown
            }
            Returns: number
          }
      vector_norm: {
        Args: {
          "": string
        }
        Returns: number
      }
      vector_out: {
        Args: {
          "": string
        }
        Returns: unknown
      }
      vector_send: {
        Args: {
          "": string
        }
        Returns: string
      }
      vector_typmod_in: {
        Args: {
          "": unknown[]
        }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
