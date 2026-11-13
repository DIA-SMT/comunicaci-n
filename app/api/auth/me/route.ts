import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // ignore (server component context)
          }
        },
      },
    }
  )

  const { data, error } = await supabase.auth.getUser()

  if (error || !data?.user) {
    return Response.json({ user: null }, { status: 401 })
  }

  // Pedimos '*' en vez de nombrar columnas: si `puede_asignar` todavía no existe
  // en la base, PostgREST rechaza la consulta entera y el usuario queda sin perfil.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .eq('habilita', 1)
    .maybeSingle()

  return Response.json(
    {
      user: {
        id: data.user.id,
        email: data.user.email,
      },
      role: (profile?.role as 'admin' | 'common' | null) ?? 'common',
      // Permiso para repartir responsables entre los miembros del área.
      canAssign: profile?.puede_asignar === true,
    },
    { status: 200 }
  )
}


