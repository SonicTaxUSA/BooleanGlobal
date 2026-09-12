// Hand-authored to match supabase/migrations/20260912000000_initial_schema.sql.
// Regenerate with `supabase gen types typescript` once the project is live:
// supabase gen types typescript --project-id <ref> > src/lib/supabase/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          role: "admin" | "staff" | "client";
          full_name: string | null;
          phone: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          role?: "admin" | "staff" | "client";
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          user_id: string | null;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          service_tags: string[];
          status: "lead" | "active" | "inactive";
          assigned_staff_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          service_tags?: string[];
          status?: "lead" | "active" | "inactive";
          assigned_staff_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          message: string | null;
          status: "new" | "contacted" | "converted" | "archived";
          converted_client_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          message?: string | null;
          status?: "new" | "contacted" | "converted" | "archived";
          converted_client_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: [];
      };
      credit_intakes: {
        Row: {
          id: string;
          client_id: string;
          date_of_birth: string | null;
          employment_status: string | null;
          monthly_income_cents: number | null;
          estimated_debt_cents: number | null;
          primary_goal: string | null;
          known_negative_items: string | null;
          authorized_credit_pull: boolean;
          ssn: string | null;
          status: "draft" | "submitted";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          date_of_birth?: string | null;
          employment_status?: string | null;
          monthly_income_cents?: number | null;
          estimated_debt_cents?: number | null;
          primary_goal?: string | null;
          known_negative_items?: string | null;
          authorized_credit_pull?: boolean;
          ssn?: string | null;
          status?: "draft" | "submitted";
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["credit_intakes"]["Insert"]>;
        Relationships: [];
      };
      document_templates: {
        Row: {
          id: string;
          name: string;
          slug: string;
          body: string;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          body: string;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_templates"]["Insert"]>;
        Relationships: [];
      };
      signature_requests: {
        Row: {
          id: string;
          client_id: string;
          template_id: string | null;
          requested_by: string | null;
          title: string;
          rendered_body: string;
          storage_path: string | null;
          document_hash: string;
          signed_storage_path: string | null;
          status: "pending" | "signed" | "voided";
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          template_id?: string | null;
          requested_by?: string | null;
          title: string;
          rendered_body: string;
          storage_path?: string | null;
          document_hash: string;
          signed_storage_path?: string | null;
          status?: "pending" | "signed" | "voided";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["signature_requests"]["Insert"]>;
        Relationships: [];
      };
      signatures: {
        Row: {
          id: string;
          signature_request_id: string;
          signer_user_id: string;
          consent_given: boolean;
          consent_text: string;
          signature_type: "typed" | "drawn";
          signature_text: string | null;
          signature_image_path: string | null;
          signed_at: string;
          ip_address: string | null;
          user_agent: string | null;
          document_hash_at_signing: string;
        };
        Insert: {
          id?: string;
          signature_request_id: string;
          signer_user_id: string;
          consent_given: boolean;
          consent_text: string;
          signature_type: "typed" | "drawn";
          signature_text?: string | null;
          signature_image_path?: string | null;
          signed_at?: string;
          ip_address?: string | null;
          user_agent?: string | null;
          document_hash_at_signing: string;
        };
        Update: Partial<Database["public"]["Tables"]["signatures"]["Insert"]>;
        Relationships: [];
      };
      signature_audit_log: {
        Row: {
          id: string;
          signature_request_id: string;
          event: "sent" | "viewed" | "signed" | "voided";
          actor_user_id: string | null;
          ip_address: string | null;
          user_agent: string | null;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          signature_request_id: string;
          event: "sent" | "viewed" | "signed" | "voided";
          actor_user_id?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["signature_audit_log"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: "admin" | "staff" | "client" };
      current_client_id: { Args: Record<string, never>; Returns: string };
      can_access_client: { Args: { target_client_id: string }; Returns: boolean };
      can_view_sensitive_data: { Args: { target_client_id: string }; Returns: boolean };
    };
    Enums: {
      user_role: "admin" | "staff" | "client";
      client_status: "lead" | "active" | "inactive";
      lead_status: "new" | "contacted" | "converted" | "archived";
      intake_status: "draft" | "submitted";
      signature_request_status: "pending" | "signed" | "voided";
      signature_audit_event: "sent" | "viewed" | "signed" | "voided";
    };
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
