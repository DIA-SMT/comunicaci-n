'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Project, Task, TaskAssignee } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TaskForm } from '@/components/task-form'
import { TaskEditForm } from '@/components/task-edit-form'
import { ProjectCompletionModal } from '@/components/project-completion-modal'
import { ArrowLeft, Calendar, CheckCircle2, Circle, Clock } from 'lucide-react'

type TaskWithAssignees = Task & {
    assignees: TaskAssignee[]
}

export function ProjectDetailView({ projectId }: { projectId: string }) {
    const router = useRouter()
    const [project, setProject] = useState<Project | null>(null)
    const [tasks, setTasks] = useState<TaskWithAssignees[]>([])
    const [loading, setLoading] = useState(true)
    const [showCompletionModal, setShowCompletionModal] = useState(false)

    const fetchProjectData = useCallback(async () => {
        try {
            // Fetch project
            const { data: projectData } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single()

            if (projectData) setProject(projectData)

            // Fetch tasks with assignees using a join
            const { data: tasksData } = await supabase
                .from('tasks')
                .select('*, task_assignees(id, assignee_name)') // Select specific fields from task_assignees
                .eq('project_id', projectId)
                .order('created_at', { ascending: true })

            if (tasksData) {
                // Transform data to match TaskWithAssignees type
                // task_assignees returns an array of objects { id, assignee_name }
                // We map this to match our TaskAssignee type roughly or just cast/use as is
                const tasksWithAssigneesFormatted = tasksData.map((task: any) => ({
                    ...task,
                    assignees: task.task_assignees || []
                }))

                setTasks(tasksWithAssigneesFormatted)

                // Check if all tasks are completed
                // We no longer auto-show the modal here. The flow is: 
                // All tasks done -> Project moves to "Listo PP" in list view -> User clicks "Publicar" in list view -> Modal opens.
                /*
                const allCompleted = tasksWithAssigneesFormatted.length > 0 &&
                    tasksWithAssigneesFormatted.every((t: Task) => t.status === 'Terminada')

                if (allCompleted && !projectData?.completed_at) {
                    setShowCompletionModal(true)
                }
                */
            }
        } catch (error) {
            console.error('Error fetching project data:', error)
        } finally {
            setLoading(false)
        }
    }, [projectId])

    useEffect(() => {
        fetchProjectData()
    }, [fetchProjectData])

    const completedTasks = tasks.filter(t => t.status === 'Terminada').length
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0

    const getStatusIcon = (status: string | null) => {
        switch (status) {
            case 'Terminada':
                return <CheckCircle2 className="w-5 h-5 text-green-600" />
            case 'En desarrollo':
                return <Clock className="w-5 h-5 text-blue-600" />
            default:
                return <Circle className="w-5 h-5 text-slate-400" />
        }
    }

    const getStatusColor = (status: string | null) => {
        switch (status) {
            case 'Terminada':
                return 'bg-green-100 text-green-800'
            case 'En desarrollo':
                return 'bg-blue-100 text-blue-800'
            default:
                return 'bg-slate-100 text-slate-600'
        }
    }

    if (loading) return <div className="p-8">Cargando proyecto...</div>
    if (!project) return <div className="p-8">Proyecto no encontrado</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <Button
                    variant="ghost"
                    onClick={() => router.push('/')}
                    className="mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a proyectos
                </Button>

                {/* Completion Analysis - Highly Visible */}
                {project.completion_analysis && (
                    <Card className="mb-6 bg-amber-50 border-amber-200 shadow-md">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl font-bold text-amber-900 flex items-center gap-2">
                                <CheckCircle2 className="w-6 h-6" />
                                Análisis de Finalización
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-amber-900/80 leading-relaxed whitespace-pre-wrap font-medium">
                                {project.completion_analysis}
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* Project Info Card */}
                <Card className="mb-6 border-l-4" style={{
                    borderLeftColor:
                        project.priority === 'Urgente' ? '#ef4444' :
                            project.priority === 'Alta' ? '#f97316' :
                                project.priority === 'Media' ? '#eab308' :
                                    '#10b981'
                }}>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <CardTitle className="text-3xl font-bold mb-2">{project.title}</CardTitle>
                                {project.description && (
                                    <p className="text-slate-600 mb-4">{project.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {project.area && (
                                        <Badge variant="outline">{project.area}</Badge>
                                    )}
                                    {project.type && (
                                        <Badge variant="outline">{project.type}</Badge>
                                    )}
                                    <Badge variant={project.priority === 'Urgente' ? 'destructive' : 'secondary'}>
                                        {project.priority}
                                    </Badge>
                                    <Badge className={getStatusColor(project.status)}>
                                        {project.status}
                                    </Badge>
                                </div>
                                {project.deadline && (
                                    <div className="flex items-center gap-2 text-slate-600">
                                        <Calendar className="w-4 h-4" />
                                        <span className="text-sm">
                                            Fecha límite: {new Date(project.deadline).toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {/* Progress Bar */}
                        <div className="mb-2">
                            <div className="flex justify-between text-sm text-slate-600 mb-2">
                                <span className="font-semibold">Progreso del proyecto</span>
                                <span className="font-bold text-lg">{progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1">
                                <span>{completedTasks} de {tasks.length} tareas completadas</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tasks Section */}
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-slate-900">Tareas</h2>
                    {!project.completed_at && (
                        <TaskForm onTaskCreated={fetchProjectData} projectId={projectId} />
                    )}
                </div>

                {tasks.length === 0 ? (
                    <Card className="p-8 text-center">
                        <p className="text-slate-500 mb-4">No hay tareas en este proyecto</p>
                        {!project.completed_at && (
                            <TaskForm onTaskCreated={fetchProjectData} projectId={projectId} />
                        )}
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {tasks.map((task) => (
                            <Card key={task.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1">
                                            {getStatusIcon(task.status)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-2 mb-2">
                                                <h3 className="font-semibold text-lg">{task.title}</h3>
                                                <div className="flex gap-2 items-center w-full md:w-auto">
                                                    <Select
                                                        disabled={!!project.completed_at}
                                                        value={task.status || 'Sin empezar'}
                                                        onValueChange={async (newStatus) => {
                                                            // Optimistic update
                                                            const previousTasks = [...tasks]
                                                            setTasks(tasks.map(t =>
                                                                t.id === task.id ? { ...t, status: newStatus } : t
                                                            ))

                                                            try {
                                                                const { error } = await supabase
                                                                    .from('tasks')
                                                                    .update({ status: newStatus })
                                                                    .eq('id', task.id)

                                                                if (error) throw error

                                                                // Refresh to ensure consistency (e.g. completion modal)
                                                                fetchProjectData()
                                                            } catch (error) {
                                                                console.error('Error updating task status:', error)
                                                                alert('No se pudo actualizar el estado de la tarea')
                                                                // Revert on error
                                                                setTasks(previousTasks)
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="w-full md:w-[140px]">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Sin empezar">Sin empezar</SelectItem>
                                                            <SelectItem value="En desarrollo">En desarrollo</SelectItem>
                                                            <SelectItem value="Terminada">Terminada</SelectItem>
                                                        </SelectContent>
                                                    </Select>

                                                    {!project.completed_at && (
                                                        <TaskEditForm
                                                            task={task}
                                                            onTaskUpdated={fetchProjectData}
                                                            onTaskDeleted={fetchProjectData}
                                                        />
                                                    )}
                                                </div>
                                            </div>

                                            {task.assignees.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-2">
                                                    {task.assignees.map((assignee) => (
                                                        <Badge key={assignee.id} variant="outline" className="text-xs">
                                                            {assignee.assignee_name}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}

                                            {task.notes && (
                                                <p className="text-sm text-slate-600 mb-2">{task.notes}</p>
                                            )}

                                            {task.link && (
                                                <a
                                                    href={task.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-sm text-blue-600 hover:underline"
                                                >
                                                    Ver enlace →
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Completion Modal */}
                {showCompletionModal && (
                    <ProjectCompletionModal
                        projectId={projectId}
                        onClose={() => {
                            setShowCompletionModal(false)
                            fetchProjectData()
                        }}
                    />
                )}
            </div>
        </div>
    )
}
