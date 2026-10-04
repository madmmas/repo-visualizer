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
          adapter: string | null;
          commit_sha: string | null;
          coverage_percent: number | null;
          created_at: string;
          failure: string | null;
          files_found: number | null;
          files_parsed: number | null;
          files_skipped: number | null;
          id: number;
          imports_resolved: number | null;
          imports_seen: number | null;
          imports_unresolved: number | null;
          analysed_at: string | null;
          organization_id: string;
          repository: string;
          repository_bytes: number | null;
          repository_files: number | null;
          repository_key: string;
          stage: string | null;
          stage_message: string | null;
          started_at: string | null;
          state: string;
          updated_at: string;
        };
        Insert: {
          adapter?: string | null;
          commit_sha?: string | null;
          coverage_percent?: number | null;
          created_at?: string;
          failure?: string | null;
          files_found?: number | null;
          files_parsed?: number | null;
          files_skipped?: number | null;
          id?: never;
          imports_resolved?: number | null;
          imports_seen?: number | null;
          imports_unresolved?: number | null;
          analysed_at?: string | null;
          organization_id: string;
          repository: string;
          repository_bytes?: number | null;
          repository_files?: number | null;
          repository_key: string;
          stage?: string | null;
          stage_message?: string | null;
          started_at?: string | null;
          state: string;
          updated_at?: string;
        };
        Update: {
          adapter?: string | null;
          commit_sha?: string | null;
          coverage_percent?: number | null;
          created_at?: string;
          failure?: string | null;
          files_found?: number | null;
          files_parsed?: number | null;
          files_skipped?: number | null;
          id?: never;
          imports_resolved?: number | null;
          imports_seen?: number | null;
          imports_unresolved?: number | null;
          analysed_at?: string | null;
          organization_id?: string;
          repository?: string;
          repository_bytes?: number | null;
          repository_files?: number | null;
          repository_key?: string;
          stage?: string | null;
          stage_message?: string | null;
          started_at?: string | null;
          state?: string;
          updated_at?: string;
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
          analysis_id: number;
          from_path: string;
          id: number;
          kind: string;
          organization_id: string;
          specifier: string;
          to_path: string;
        };
        Insert: {
          analysis_id: number;
          from_path: string;
          id?: never;
          kind: string;
          organization_id: string;
          specifier: string;
          to_path: string;
        };
        Update: {
          analysis_id?: number;
          from_path?: string;
          id?: never;
          kind?: string;
          organization_id?: string;
          specifier?: string;
          to_path?: string;
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
          analysis_id: number;
          fan_in: number;
          fan_out: number;
          folder: string;
          hash: string;
          id: number;
          lines: number;
          organization_id: string;
          path: string;
        };
        Insert: {
          analysis_id: number;
          fan_in: number;
          fan_out: number;
          folder: string;
          hash: string;
          id?: never;
          lines: number;
          organization_id: string;
          path: string;
        };
        Update: {
          analysis_id?: number;
          fan_in?: number;
          fan_out?: number;
          folder?: string;
          hash?: string;
          id?: never;
          lines?: number;
          organization_id?: string;
          path?: string;
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
