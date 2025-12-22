'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. ' +
        'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment.'
    )
}

// Importante: usamos el mismo tipo de cliente que el login (createBrowserClient),
// para que la sesión (cookies) sea consistente en toda la app. Evita casos en prod
// donde el dashboard queda cargando o no ve la sesión.
let _supabase: ReturnType<typeof createBrowserClient<Database>> | null = null

export const supabase =
    _supabase ?? (_supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey))
