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
import { ProjectSummary } from '@/components/project-summary'
import { Calendar, FolderKanban, Users, Search, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { ProjectProgressChart } from '@/components/project-progress-chart'
import { ProjectCompletionModal } from '@/components/project-completion-modal'

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
    const [filter, setFilter] = useState<'active' | 'urgent' | 'due_soon' | 'completed' | 'ready'>('active')
    const [searchQuery, setSearchQuery] = useState('')
    const [chartData, setChartData] = useState<ProjectProgress[]>([])
    const [activeCompletionProjectId, setActiveCompletionProjectId] = useState<string | null>(null)
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
    }, [authLoading, user])

    const fetchProjects = useCallback(async () => {
        try {
            setLoadError(null)
            const query = supabase
                .from('projects')
                .select('*')
                .order('deadline', { ascending: true })

            const { data } = await query

            if (data) setProjects(data)
        } catch (error) {
            console.error('Error fetching projects:', error)
            setLoadError('No se pudieron cargar los proyectos. Reintentá.')
        } finally {
            setLoading(false)
        }
    }, [])

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
        // Fetch only once on mount since we get all projects
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

    const markProjectAsCompleted = (e: React.MouseEvent, projectId: string) => {
        e.stopPropagation()
        setActiveCompletionProjectId(projectId)
    }

    const filteredProjects = projects.filter(project => {
        const matchesSearch =
            project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (project.area && project.area.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))

        let matchesFilter = false

        if (filter === 'active') {
            matchesFilter = project.completed_at === null && (projectProgress[project.id] || 0) < 100
        } else if (filter === 'completed') {
            matchesFilter = project.completed_at !== null
        } else if (filter === 'ready') {
            matchesFilter = project.completed_at === null && (projectProgress[project.id] || 0) === 100
        } else if (filter === 'urgent') {
            matchesFilter = project.completed_at === null && project.priority === 'Urgente' && (projectProgress[project.id] || 0) < 100
        } else if (filter === 'due_soon') {
            if (project.completed_at || !project.deadline) {
                matchesFilter = false
            } else if ((projectProgress[project.id] || 0) === 100) {
                matchesFilter = false
            } else {
                const today = new Date()
                const currentDay = today.getDay()
                const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1
                const monday = new Date(today)
                monday.setDate(today.getDate() - distanceToMonday)
                monday.setHours(0, 0, 0, 0)
                const sunday = new Date(monday)
                sunday.setDate(monday.getDate() + 6)
                sunday.setHours(23, 59, 59, 999)
                const deadline = new Date(project.deadline)
                matchesFilter = deadline >= monday && deadline <= sunday
            }
        }

        return matchesSearch && matchesFilter
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
                {filter !== 'active' && (
                    <Button
                        variant="ghost"
                        onClick={() => setFilter('active')}
                        className="mb-4"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver a activos
                    </Button>
                )}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-4xl font-bold text-slate-900 mb-2">Proyectos</h1>
                        <p className="text-slate-600">Gestiona y da seguimiento a tus proyectos</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
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

                {/* Project Summary Dashboard */}
                <ProjectSummary
                    projects={projects}
                    currentFilter={filter}
                    onFilterChange={setFilter}
                    projectProgress={projectProgress}
                />

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
                            {searchQuery ? 'No se encontraron proyectos' : (filter === 'completed' ? 'No hay proyectos completados' : filter === 'ready' ? 'No hay proyectos listos para publicar' : 'No hay proyectos')}
                        </h3>
                        <p className="text-slate-500 mb-6">
                            {searchQuery ? 'Intenta con otros términos de búsqueda' : (filter === 'completed' ? 'Completa tareas para terminar proyectos' : filter === 'ready' ? 'Completa todas las tareas para mover proyectos aquí' : 'Comienza creando tu primer proyecto')}
                        </p>
                        {filter === 'active' && !searchQuery && <ProjectForm onProjectCreated={fetchProjects} />}
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

                                    {/* Action Buttons */}
                                    {(projectProgress[project.id] || 0) === 100 && !project.completed_at && (
                                        <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                                            <Button
                                                size="sm"
                                                className="bg-purple-600 hover:bg-purple-700 text-white w-full sm:w-auto"
                                                onClick={(e) => markProjectAsCompleted(e, project.id)}
                                            >
                                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                                Publicar / Finalizar
                                            </Button>
                                        </div>
                                    )}
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

            {/* Completion Modal */}
            {activeCompletionProjectId && (
                <ProjectCompletionModal
                    projectId={activeCompletionProjectId}
                    onClose={() => {
                        setActiveCompletionProjectId(null)
                        fetchProjects()
                    }}
                />
            )}
        </div>
    )
}
