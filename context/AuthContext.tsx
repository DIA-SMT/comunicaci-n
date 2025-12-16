'use client'

import { createClient } from '@/lib/supabase/client'
import { createContext, useContext, useEffect, useState } from 'react'
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
    const supabase = createClient()

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                if (currentSession?.user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', currentSession.user.id)
                        .single()

                    setRole(profile?.role as 'admin' | 'common' || 'common')
                }
            } catch (error) {
                console.error('Error initializing auth:', error)
            } finally {
                setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            setSession(newSession)
            setUser(newSession?.user ?? null)

            if (newSession?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', newSession.user.id)
                    .single()

                setRole(profile?.role as 'admin' | 'common' || 'common')
            } else {
                setRole(null)
            }

            setLoading(false)
        })

        return () => {
            subscription.unsubscribe()
        }
    }, [supabase])

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
