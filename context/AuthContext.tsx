'use client'

import { createClient } from '@/lib/supabase/client'
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
    const supabase = createClient()

    const lastUserId = useRef<string | null>(null)

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Use getUser to validate the session with the server instead of just reading local storage
                const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()

                if (userError || !currentUser) {
                    // If token is invalid or user doesn't exist, clear everything
                    setSession(null)
                    setUser(null)
                    setRole(null)
                    return
                }

                // If we have a valid user, get the session too (getUser doesn't return the session object directly)
                const { data: { session: currentSession } } = await supabase.auth.getSession()
                setSession(currentSession)
                setUser(currentUser)

                if (currentUser) {
                    lastUserId.current = currentUser.id
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('id', currentUser.id)
                        .single()

                    setRole(profile?.role as 'admin' | 'common' || 'common')
                }
            } catch (error) {
                console.error('Error initializing auth:', error)
                // Force cleanup on error
                setSession(null)
                setUser(null)
                setRole(null)
            } finally {
                setLoading(false)
            }
        }

        initializeAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
            try {
                // Handle specific events that should force a reset
                if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESH_REVOKED') {
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
                            .single()

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
            }
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
