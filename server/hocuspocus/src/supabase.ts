/**
 * Hocuspocusサーバー共通 Supabase クライアント
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const supabaseUrl = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
export const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

/** service_role クライアント（RLSバイパス）。キー未設定時は null */
export const supabase: SupabaseClient | null = supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null
