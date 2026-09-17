import superjson from "superjson";

export type OutputType = {
  connected: boolean;
  database: string;
  schema: string;
  projectRef: string | null;
  coreTables: string[];
};

export const getSupabaseHealth = async (init?: RequestInit): Promise<OutputType> => {
  const response = await fetch("/_api/integrations/supabaseHealth", { method: "GET", ...init });
  if (!response.ok) {
    const body = superjson.parse<{ error: string }>(await response.text());
    throw new Error(body.error);
  }
  return superjson.parse<OutputType>(await response.text());
};