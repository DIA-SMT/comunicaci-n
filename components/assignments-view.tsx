'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Project, Task, TaskAssignee } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, ArrowLeft, User } from 'lucide-react'



type TaskWithProject = Task & {
    project: Project | null
}

type AssigneeWithTasks = {
    name: string
    tasks: TaskWithProject[]
}



export function AssignmentsView() {
    const router = useRouter()
    const [assignees, setAssignees] = useState<AssigneeWithTasks[]>([])

    const [loading, setLoading] = useState(true)
    const [expandedAssignee, setExpandedAssignee] = useState<string | null>(null)

    useEffect(() => {
        fetchAssignments()
    }, [])

    async function fetchAssignments() {
        try {


            // Fetch all task assignees
            const { data: taskAssignees } = await supabase
                .from('task_assignees')
                .select('*')

            if (!taskAssignees) return

            // Group by assignee name
            const assigneeMap = new Map<string, TaskWithProject[]>()

            for (const assignee of taskAssignees) {
                // Fetch task details
                const { data: task } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('id', assignee.task_id)
                    .single()

                if (!task) continue

                // Fetch project details
                const { data: project } = await supabase
                    .from('projects')
                    .select('*')
                    .eq('id', task.project_id || '')
                    .single()

                const taskWithProject: TaskWithProject = {
                    ...task,
                    project: project || null
                }

                if (!assigneeMap.has(assignee.assignee_name)) {
                    assigneeMap.set(assignee.assignee_name, [])
                }
                assigneeMap.get(assignee.assignee_name)!.push(taskWithProject)
            }

            // Convert to array
            const assigneesList: AssigneeWithTasks[] = Array.from(assigneeMap.entries()).map(
                ([name, tasks]) => ({
                    name,
                    tasks: tasks.sort((a, b) => {
                        // Sort by project name, then task name
                        const projectA = a.project?.title || ''
                        const projectB = b.project?.title || ''
                        if (projectA !== projectB) {
                            return projectA.localeCompare(projectB)
                        }
                        return a.title.localeCompare(b.title)
                    })
                })
            )

            // Sort by assignee name
            assigneesList.sort((a, b) => a.name.localeCompare(b.name))

            setAssignees(assigneesList)
        } catch (error) {
            console.error('Error fetching assignments:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleAssignee = (name: string) => {
        setExpandedAssignee(prev => prev === name ? null : name)
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

    if (loading) return <div className="p-8">Cargando asignaciones...</div>

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
            <div className="max-w-7xl mx-auto">
                <Button
                    variant="ghost"
                    onClick={() => router.push('/')}
                    className="mb-4"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver a proyectos
                </Button>

                <div className="mb-8">
                    <h1 className="text-4xl font-bold text-slate-900 mb-2">Asignaciones</h1>
                    <p className="text-slate-600">Tareas asignadas por persona</p>
                </div>

                {assignees.length === 0 ? (
                    <Card className="p-8 text-center">
                        <User className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-semibold text-slate-700 mb-2">No hay asignaciones</h3>
                        <p className="text-slate-500">Crea tareas y asigna responsables para verlas aquí</p>
                    </Card>
                ) : (
                    <div className="columns-1 lg:columns-2 gap-6 space-y-6">
                        {assignees.map((assignee) => {
                            const isExpanded = expandedAssignee === assignee.name
                            return (
                                <Card key={assignee.name} className="break-inside-avoid border-l-4 border-l-blue-500 transition-all duration-200">
                                    <CardHeader
                                        className="bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => toggleAssignee(assignee.name)}
                                    >
                                        <CardTitle className="flex flex-col sm:flex-row sm:items-center gap-2 select-none">
                                            <div className="flex items-center gap-2">
                                                <User className="w-5 h-5 text-slate-500" />
                                                <span>{assignee.name}</span>
                                            </div>
                                            <div className="sm:ml-auto flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                                                <Badge variant="secondary">
                                                    {assignee.tasks.length} {assignee.tasks.length === 1 ? 'tarea' : 'tareas'}
                                                </Badge>
                                                {isExpanded ? (
                                                    <ChevronUp className="w-5 h-5 text-slate-400" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-slate-400" />
                                                )}
                                            </div>
                                        </CardTitle>
                                    </CardHeader>
                                    {isExpanded && (
                                        <CardContent className="pt-4 animate-in slide-in-from-top-2 duration-200">
                                            <div className="space-y-3">
                                                {assignee.tasks.map((task) => (
                                                    <div
                                                        key={task.id}
                                                        className="border rounded-lg p-3 hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            if (task.project) router.push(`/projects/${task.project.id}`)
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex-1">
                                                                <p className="font-semibold text-sm">{task.title}</p>
                                                                {task.project && (
                                                                    <p className="text-xs text-slate-500 mt-1">
                                                                        📁 {task.project.title}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <Badge className={`${getStatusColor(task.status)} text-xs ml-2`}>
                                                                {task.status || 'Sin empezar'}
                                                            </Badge>
                                                        </div>
                                                        {task.notes && (
                                                            <p className="text-xs text-slate-600 mt-2 line-clamp-2">{task.notes}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    )}
                                </Card>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
