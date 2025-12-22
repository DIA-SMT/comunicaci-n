'use client'

import { supabase } from '@/lib/supabase'
import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { User, Session } from '@supabase/supabase-js'

type AuthContextType = {
    user: User | null
    session: Session | null
    role: 'admin' | 'common' | null
    loading: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    role: null,
    loading: true,
    signOut: async () => { }
})

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [role, setRole] = useState<'admin' | 'common' | null>(null)
    const [loading, setLoading] = useState(true)

    const lastUserId = useRef<string | null>(null)
    const loadingTimeoutRef = useRef<number | null>(null)

    useEffect(() => {
        // Watchdog: en prod a veces una promesa de auth queda colgada (red, third-party, etc.).
        // Nunca dejamos loading infinito.
        loadingTimeoutRef.current = window.setTimeout(() => {
            setLoading(false)
        }, 8000)

        const initializeAuth = async () => {
            try {
                // En refresh, NO dependemos de una llamada remota (getUser) para salir de loading.
                // Primero leemos sesión local (rápido) y luego validamos en background.
                const { data: { session: currentSession } } = await supabase.auth.getSession()

                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                if (currentSession?.user) {
                    lastUserId.current = currentSession.user.id
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', currentSession.user.id)
                        .maybeSingle()

                    setRole((profile?.role as 'admin' | 'common') || 'common')
                } else {
                    setRole(null)
                    lastUserId.current = null
                }

                // Validación remota: en prod necesitamos esto para detectar sesión válida post-refresh
                // (y es la request "user" que estás mirando en Network). No debe colgar infinito:
                // tenemos fetch timeout global + watchdog local.
                try {
                    const { data, error } = await supabase.auth.getUser()

                    // Si hay una sesión local pero falla la validación por red/timeout,
                    // NO limpiamos para evitar logout falso; reintentamos luego.
                    if (error && currentSession) {
                        window.setTimeout(() => {
                            supabase.auth.getUser().then(({ data: d2, error: e2 }) => {
                                if (e2) return
                                setUser(d2?.user ?? null)
                                if (!d2?.user) {
                                    setSession(null)
                                    setRole(null)
                                    lastUserId.current = null
                                }
                            }).catch(() => { })
                        }, 1500)
                    } else {
                        setUser(data?.user ?? null)
                        if (!data?.user) {
                            setSession(null)
                            setRole(null)
                            lastUserId.current = null
                        }
                    }
                } catch {
                    // ignore: sesión local puede seguir funcionando; el watchdog evita loading infinito
                }
            } catch (error) {
                console.error('Error initializing auth:', error)
                // Force cleanup on error
                setSession(null)
                setUser(null)
                setRole(null)
            } finally {
                setLoading(false)
                if (loadingTimeoutRef.current) {
                    window.clearTimeout(loadingTimeoutRef.current)
                    loadingTimeoutRef.current = null
                }
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            try {
                // Handle specific events that should force a reset
                // Supabase typings no siempre incluyen todos los eventos posibles.
                const eventName = event as string
                if (event === 'SIGNED_OUT' || eventName === 'TOKEN_REFRESH_REVOKED') {
                    setSession(null)
                    setUser(null)
                    setRole(null)
                    lastUserId.current = null
                    setLoading(false)
                    return
                }

                setSession(newSession)
                setUser(newSession?.user ?? null)

                if (newSession?.user) {
                    // Only fetch role if user ID has changed or we don't have a role yet
                    if (newSession.user.id !== lastUserId.current) {
                        lastUserId.current = newSession.user.id
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('role')
                            .eq('id', newSession.user.id)
                            .maybeSingle()

                        setRole(profile?.role as 'admin' | 'common' || 'common')
                    }
                } else {
                    lastUserId.current = null
                    setRole(null)
                }
            } catch (error) {
                console.error('Error in onAuthStateChange:', error)
            } finally {
                setLoading(false)
                if (loadingTimeoutRef.current) {
                    window.clearTimeout(loadingTimeoutRef.current)
                    loadingTimeoutRef.current = null
                }
            }
        })

        return () => {
            subscription.unsubscribe()
            if (loadingTimeoutRef.current) {
                window.clearTimeout(loadingTimeoutRef.current)
                loadingTimeoutRef.current = null
            }
        }
    }, [])

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
        setRole(null)
    }

    return (
        <AuthContext.Provider value={{ user, session, role, loading, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
