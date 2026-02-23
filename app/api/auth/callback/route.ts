import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const type = searchParams.get('type')

    // if "next" is in param, use it as the redirect URL
    // Default to /reset-password if it's a recovery flow, otherwise /
    let next = searchParams.get('next')
    if (!next) {
        next = type === 'recovery' ? '/reset-password' : '/'
    }

    // Importante: Creamos la respuesta PRIMERO para poder setearle las cookies
    const response = NextResponse.redirect(`${origin}${next}`)

    if (code) {
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
                        cookiesToSet.forEach(({ name, value, options }) =>
                            response.cookies.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error) {
            return response
        }
    }

    // Si no hay código o hubo error, redirigir a un error o login
    // Agregamos un query param de error para mostrar feedback al usuario
    return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
