'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Project, Task } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProjectForm } from '@/components/project-form'
import { Input } from '@/components/ui/input'
import { Calendar, FolderKanban, Users, Search } from 'lucide-react'
import { ProjectProgressChart } from '@/components/project-progress-chart'

type ProjectProgress = {
    name: string
    completed: number
    remaining: number
    total: number
}

export function ProjectsListView() {
    const router = useRouter()
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [showCompleted, setShowCompleted] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [chartData, setChartData] = useState<ProjectProgress[]>([])
    const { role, user, loading: authLoading } = useAuth()

    useEffect(() => {
        if (authLoading) return
        if (!user) {
            router.replace('/login')
            return
        }

        setLoading(true)
        setLoadError(null)

        const t = window.setTimeout(() => {
            setLoading(false)
            setLoadError('La carga tardó demasiado. Reintentá.')
        }, 12000)

        Promise.all([fetchProjects(), fetchChartData()]).finally(() => window.clearTimeout(t))
    }, [showCompleted, authLoading, user])

    const fetchProjects = useCallback(async () => {
        try {
            setLoadError(null)
            let query = supabase
                .from('projects')
                .select('*')
                .order('deadline', { ascending: true })

            if (showCompleted) {
                query = query.not('completed_at', 'is', null)
            } else {
                query = query.is('completed_at', null)
            }

            const { data } = await query

            if (data) setProjects(data)
        } catch (error) {
            console.error('Error fetching projects:', error)
            setLoadError('No se pudieron cargar los proyectos. Reintentá.')
        } finally {
            setLoading(false)
        }
    }, [showCompleted])

    const fetchChartData = useCallback(async () => {
        try {
            setLoadError(null)
            const { data: allTasks } = await supabase
                .from('tasks')
                .select('*, projects(*)')

            const progressMap = new Map<string, ProjectProgress>()

            if (allTasks) {
                // Define a type for the joined query result
                type TaskWithProject = Task & { projects: Project | null }

                (allTasks as unknown as TaskWithProject[]).forEach((task) => {
                    const projectName = task.projects?.title || 'Sin Proyecto'
                    if (!progressMap.has(projectName)) {
                        progressMap.set(projectName, {
                            name: projectName,
                            completed: 0,
                            remaining: 0,
                            total: 0
                        })
                    }

                    const stats = progressMap.get(projectName)!
                    stats.total++
                    if (task.status === 'Terminada') {
                        stats.completed++
                    } else {
                        stats.remaining++
                    }
                })
            }

            setChartData(Array.from(progressMap.values()).sort((a, b) => b.total - a.total))
        } catch (error) {
            console.error('Error fetching chart data:', error)
            setLoadError('No se pudieron cargar los datos del gráfico.')
        }
    }, [])

    useEffect(() => {
        if (authLoading) return
        if (!user) return
        fetchProjects()
        fetchChartData()
    }, [fetchProjects, fetchChartData, authLoading, user])

    async function getProjectProgress(projectId: string) {
        const { data: tasks } = await supabase
            .from('tasks')
            .select('status')
            .eq('project_id', projectId)

        if (!tasks || tasks.length === 0) return 0

        const completed = tasks.filter(t => t.status === 'Terminada').length
        return Math.round((completed / tasks.length) * 100)
    }

    const [projectProgress, setProjectProgress] = useState<Record<string, number>>({})

    useEffect(() => {
        async function loadProgress() {
            const progress: Record<string, number> = {}
            for (const project of projects) {
                progress[project.id] = await getProjectProgress(project.id)
            }
            setProjectProgress(progress)
        }
        if (projects.length > 0) {
            loadProgress()
        }
    }, [projects])

    const filteredProjects = projects.filter(project => {
        const searchLower = searchQuery.toLowerCase()
        return (
            project.title.toLowerCase().includes(searchLower) ||
            (project.area && project.area.toLowerCase().includes(searchLower)) ||
            (project.description && project.description.toLowerCase().includes(searchLower))
        )
    })

    if (authLoading) return <div className="p-8">Cargando sesión...</div>
    if (!user) return null
    if (loading) return <div className="p-8">Cargando proyectos...</div>
    if (loadError) {
        return (
            <div className="p-8">
                <div className="mb-3 font-medium text-slate-700">{loadError}</div>
                <Button
                    variant="outline"
                    onClick={() => {
                        setLoading(true)
                        setLoadError(null)
                        fetchProjects()
                        fetchChartData()
                    }}
                >
                    Reintentar
                </Button>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">Proyectos</h1>
                        <p className="text-slate-600">Gestiona y da seguimiento a tus proyectos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                        <Button
                            variant={showCompleted ? "secondary" : "outline"}
                            onClick={() => setShowCompleted(!showCompleted)}
                            className="w-full sm:w-auto"
                        >
                            {showCompleted ? 'Ver Activos' : 'Ver Completados'}
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/assignments')} className="w-full sm:w-auto">
                            <Users className="w-4 h-4 mr-2" />
                            Asignaciones
                        </Button>
                        {role === 'admin' && (
                            <Button variant="outline" onClick={() => router.push('/members')} className="w-full sm:w-auto">
                                <Users className="w-4 h-4 mr-2" />
                                Miembros
                            </Button>
                        )}
                        <div className="w-full sm:w-auto">
                            <ProjectForm onProjectCreated={fetchProjects} />
                        </div>
                    </div>
                </div>

                {/* Search Bar */}
                <div className="mb-6 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                        placeholder="Buscar por nombre, área o descripción..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 max-w-md bg-white"
                    />
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="text-center py-16">
                        <FolderKanban className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">
                            {searchQuery ? 'No se encontraron proyectos' : (showCompleted ? 'No hay proyectos completados' : 'No hay proyectos activos')}
                        </h3>
                        <p className="text-slate-500 mb-6">
                            {searchQuery ? 'Intenta con otros términos de búsqueda' : (showCompleted ? 'Completa tareas para terminar proyectos' : 'Comienza creando tu primer proyecto')}
                        </p>
                        {!showCompleted && !searchQuery && <ProjectForm onProjectCreated={fetchProjects} />}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((project) => (
                            <Card
                                key={project.id}
                                className={`hover:shadow-lg transition-all cursor-pointer hover:scale-105 ${project.priority === 'Urgente' ? 'bg-red-50 hover:bg-red-100' :
                                    project.priority === 'Alta' ? 'bg-orange-50 hover:bg-orange-100' :
                                        project.priority === 'Media' ? 'bg-yellow-50 hover:bg-yellow-100' :
                                            'bg-emerald-50 hover:bg-emerald-100'
                                    }`}
                                onClick={() => router.push(`/projects/${project.id}`)}
                            >
                                <CardHeader className="pb-3">
                                    <div className="flex justify-between items-start mb-2">
                                        <CardTitle className="text-lg font-bold line-clamp-2">
                                            {project.title}
                                        </CardTitle>
                                        <Badge
                                            variant={project.priority === 'Urgente' ? 'destructive' : 'secondary'}
                                            className="ml-2 shrink-0"
                                        >
                                            {project.priority}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-2 text-xs text-slate-500">
                                        {project.area && <span className="bg-slate-100 px-2 py-1 rounded">{project.area}</span>}
                                        {project.type && <span className="bg-slate-100 px-2 py-1 rounded">{project.type}</span>}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {project.description && (
                                        <p className="text-sm text-slate-600 mb-4 line-clamp-2">{project.description}</p>
                                    )}

                                    {/* Progress Bar */}
                                    <div className="mb-3">
                                        <div className="flex justify-between text-xs text-slate-600 mb-1">
                                            <span>Progreso</span>
                                            <span className="font-semibold">{projectProgress[project.id] || 0}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 rounded-full h-2">
                                            <div
                                                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all"
                                                style={{ width: `${projectProgress[project.id] || 0}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-sm">
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${project.status === 'En Progreso' ? 'bg-green-100 text-green-800' :
                                            project.status === 'Completado' ? 'bg-blue-100 text-blue-800' :
                                                'bg-yellow-100 text-yellow-800'
                                            }`}>
                                            {project.status}
                                        </span>
                                        {project.deadline && (
                                            <div className="flex items-center gap-1 text-slate-500">
                                                <Calendar className="w-4 h-4" />
                                                <span className="text-xs">
                                                    {new Date(project.deadline).toLocaleDateString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>

            {/* Project Progress Chart */}
            <div className="max-w-7xl mx-auto mt-12 pb-12">
                <ProjectProgressChart data={chartData} />
            </div>
        </div>
    )
}
