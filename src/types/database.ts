export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      analyses: {
        Row: {
          created_at: string;
          id: number;
          organization_id: string;
          repository: string;
          state: string;
        };
        Insert: {
          created_at?: string;
          id?: never;
          organization_id: string;
          repository: string;
          state: string;
        };
        Update: {
          created_at?: string;
          id?: never;
          organization_id?: string;
          repository?: string;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "analyses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      edges: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edges_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      explanations: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "explanations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      file_roles: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "file_roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      files: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      insights: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "insights_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          id: string;
        };
        Insert: {
          id: string;
        };
        Update: {
          id?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      routes: {
        Row: {
          id: number;
          organization_id: string;
        };
        Insert: {
          id?: never;
          organization_id: string;
        };
        Update: {
          id?: never;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "routes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
