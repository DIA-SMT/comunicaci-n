'use client'

import Image from 'next/image'
import './navbar.css'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, User as UserIcon } from 'lucide-react'

import Link from 'next/link'

export function Navbar() {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    const handleSignOut = async () => {
        await signOut()
        router.refresh()
        router.push('/login')
    }

    return (
        <nav className="navbar relative">
            <div className="navbar-container flex items-center justify-between w-full">
                <div className="navbar-logo">
                    <Image
                        src="/Logo_SMT_neg_4.png"
                        alt="Logo Municipalidad de San Miguel de Tucumán"
                        width={200}
                        height={200}
                        className="logo-muni"
                        priority
                        quality={100}
                        unoptimized
                    />
                </div>
                {user && (
                    <>
                        {/* Desktop View */}
                        <div className="hidden md:flex items-center gap-4">
                            <Link href="/profile" className="flex items-center gap-2 text-white hover:text-white/80 transition-colors">
                                <UserIcon className="h-4 w-4" />
                                <span className="text-sm font-medium">{user.email}</span>
                            </Link>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleSignOut}
                                className="text-white hover:text-white/80 hover:bg-white/10"
                            >
                                <LogOut className="h-4 w-4 mr-2" />
                                Salir
                            </Button>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="text-white hover:text-white/80 hover:bg-white/10"
                            >
                                <UserIcon className="h-6 w-6" />
                            </Button>
                        </div>

                        {/* Mobile Menu Dropdown */}
                        {isMobileMenuOpen && (
                            <div className="absolute top-[80px] right-0 left-0 bg-[#1f89f6] border-t border-white/20 p-4 md:hidden shadow-lg z-50 flex flex-col items-center gap-4 animate-in slide-in-from-top-2">
                                <Link
                                    href="/profile"
                                    className="flex items-center gap-2 text-white hover:text-white/80 transition-colors p-2"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <UserIcon className="h-4 w-4" />
                                    <span className="text-sm font-medium">{user.email}</span>
                                </Link>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={handleSignOut}
                                    className="w-full max-w-xs"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Salir
                                </Button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </nav>
    )
}
