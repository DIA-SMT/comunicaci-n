'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export function ProjectForm({ onProjectCreated }: { onProjectCreated: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        area: '',
        type: '',
        priority: 'Media',
        deadline: ''
    })
    const [existingAreas, setExistingAreas] = useState<string[]>([])
    const [showSuggestions, setShowSuggestions] = useState(false)
    const { role } = useAuth()



    useEffect(() => {
        if (open) {
            fetchExistingAreas()
        }
    }, [open])

    async function fetchExistingAreas() {
        const { data } = await supabase
            .from('projects')
            .select('area')

        if (data) {
            const uniqueAreas = Array.from(new Set(data.map(p => p.area).filter(Boolean))) as string[]
            setExistingAreas(uniqueAreas.sort())
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        try {
            const { error } = await supabase.from('projects').insert([
                {
                    ...formData,
                    deadline: formData.deadline || null,
                    status: 'Pendiente'
                }
            ])
            if (error) throw error
            setOpen(false)
            setFormData({ title: '', description: '', area: '', type: '', priority: 'Media', deadline: '' })
            onProjectCreated()
        } catch (error) {
            console.error('Error creating project:', error)
            console.error('Error creating project:', error)
            alert(`Error creating project: ${(error as any).message || 'Unknown error'}`)
        } finally {
            setLoading(false)
        }
    }

    const filteredAreas = existingAreas.filter(area =>
        area.toLowerCase().includes(formData.area.toLowerCase())
    )

    if (role !== 'admin') return null

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>Nuevo Proyecto</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Proyecto</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">Título</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="description">Descripción</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2 relative">
                            <Label htmlFor="area">Área</Label>
                            <Input
                                id="area"
                                value={formData.area}
                                onChange={(e) => {
                                    setFormData({ ...formData, area: e.target.value })
                                    setShowSuggestions(true)
                                }}
                                onFocus={() => setShowSuggestions(true)}
                                placeholder="Ej: Cultura"
                                autoComplete="off"
                            />
                            {showSuggestions && formData.area && filteredAreas.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto top-[70px]">
                                    {filteredAreas.map((area) => (
                                        <button
                                            key={area}
                                            type="button"
                                            className="w-full text-left px-3 py-2 hover:bg-slate-100 text-sm"
                                            onClick={() => {
                                                setFormData({ ...formData, area })
                                                setShowSuggestions(false)
                                            }}
                                        >
                                            {area}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="type">Tipo</Label>
                            <Input
                                id="type"
                                value={formData.type}
                                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                placeholder="Ej: Video"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="priority">Prioridad</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(val) => setFormData({ ...formData, priority: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Baja">Baja</SelectItem>
                                    <SelectItem value="Media">Media</SelectItem>
                                    <SelectItem value="Alta">Alta</SelectItem>
                                    <SelectItem value="Urgente">Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="deadline">Fecha Límite</Label>
                            <Input
                                id="deadline"
                                type="date"
                                value={formData.deadline}
                                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <Button type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : 'Crear Proyecto'}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    )
}
