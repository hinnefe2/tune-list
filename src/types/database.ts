// Placeholder until `supabase gen types typescript --project-id <ref>` is run
// against your Supabase project. Replace this file with the generated output.
//
// We give it a permissive shape so the app compiles in the meantime; once the
// real types land, every service file becomes properly typed automatically.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown> }>
    Views: Record<string, { Row: Record<string, unknown> }>
    Functions: Record<string, unknown>
    Enums: {
      tune_status: 'wishlist' | 'learning' | 'can_fake' | 'can_lead' | 'forgotten'
      source_kind: 'festival' | 'jam' | 'person' | 'lesson' | 'recording' | 'other'
      media_kind: 'audio' | 'video' | 'spotify' | 'sheet_music' | 'looptube' | 'tab' | 'other'
      card_kind: 'a_part' | 'b_part' | 'c_part' | 'key' | 'name_from_audio' | 'source' | 'other'
    }
    CompositeTypes: Record<string, unknown>
  }
}
