'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Task } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TaskCompletionModal } from '@/components/task-completion-modal'
import { X, CheckCircle2, Clock, CalendarDays, ExternalLink } from 'lucide-react'

type TaskWithProject = Task & {
    projects: {
        title: string
    } | null
}

interface UserTasksPanelProps {
    isOpen: boolean
    onClose: () => void
}

export function UserTasksPanel({ isOpen, onClose }: UserTasksPanelProps) {
    const { user, role } = useAuth()
    const [tasks, setTasks] = useState<TaskWithProject[]>([])
    const [loading, setLoading] = useState(false)
    const [activeTaskForCompletion, setActiveTaskForCompletion] = useState<Task | null>(null)

    const fetchTasks = useCallback(async () => {
        if (!user) return

        setLoading(true)
        try {
            let query = supabase
                .from('tasks')
                .select(`
                    *,
                    projects (
                        title
                    )
                `)
                .neq('status', 'Terminada') // Only show pending/in-progress tasks
                .eq('habilita', 1)
                .order('created_at', { ascending: false })

            if (role !== 'admin') {
                // For common users, filter by assignment
                // We need to join with task_assignees
                const { data: assignedTaskIds } = await supabase
                    .from('task_assignees')
                    .select('task_id')
                    .eq('member_id', user.id) // Assuming database has member_id mapped to auth.uid or similar logic

                // Note: The previous logic in TaskEditForm used member.id. 
                // We need to ensure we map Auth User ID to Member ID if they are different.
                // Assuming for now they are linked or we can find the member profile.

                if (user.email) {
                    const { data: memberData } = await supabase
                        .from('members')
                        .select('id')
                        .eq('email', user.email)
                        .single()

                    if (memberData) {
                        const { data: assignments } = await supabase
                            .from('task_assignees')
                            .select('task_id')
                            .eq('member_id', memberData.id)

                        if (assignments && assignments.length > 0) {
                            const taskIds = assignments.map(a => a.task_id)
                            query = query.in('id', taskIds)
                        } else {
                            // No assignments, return empty
                            setTasks([])
                            setLoading(false)
                            return
                        }
                    } else {
                        // Fallback if no member profile found
                        setTasks([])
                        setLoading(false)
                        return
                    }
                } else {
                    setTasks([])
                    setLoading(false)
                    return
                }
            }

            const { data, error } = await query

            if (error) throw error

            // Type assertion for the join result
            setTasks(data as any as TaskWithProject[])

        } catch (error) {
            console.error('Error fetching tasks:', error)
        } finally {
            setLoading(false)
        }
    }, [user, role])

    useEffect(() => {
        if (isOpen) {
            fetchTasks()
        }
    }, [isOpen, fetchTasks])

    async function handleTaskCompletion(notes: string) {
        if (!activeTaskForCompletion) return

        try {
            const { error } = await supabase
                .from('tasks')
                .update({
                    status: 'Terminada',
                    notes: notes || activeTaskForCompletion.notes // Keep old notes if new ones empty? Or just update. Let's append or replace based on modal logic. Usually logic is in modal. here updates.
                    // The modal returns 'notes'.
                })
                .eq('id', activeTaskForCompletion.id)

            if (error) throw error

            // Refresh list
            fetchTasks()
            setActiveTaskForCompletion(null)
        } catch (error) {
            console.error('Error completing task:', error)
            alert('Error al finalizar la tarea')
        }
    }

    if (!isOpen) return null

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 w-full md:w-[400px] h-[100dvh] bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col">
                <div className="p-4 border-b flex items-center justify-between bg-slate-50 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">
                            {role === 'admin' ? 'Todas las Tareas Pendientes' : 'Mis Tareas'}
                        </h2>
                        <p className="text-sm text-slate-500">
                            {tasks.length} tareas pendientes
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <span className="loading-spinner">Cargando...</span>
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-10 text-slate-500">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                            <p>¡Todo al día!</p>
                            <p className="text-sm">No tienes tareas pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map(task => (
                                <div
                                    key={task.id}
                                    className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 hover:shadow-md transition-shadow group"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <Badge variant="outline" className="mb-2 bg-slate-50">
                                            {task.projects?.title || 'Sin proyecto'}
                                        </Badge>
                                        <Badge className={`${task.status === 'En desarrollo' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {task.status}
                                        </Badge>
                                    </div>

                                    <h3 className="font-semibold text-slate-900 mb-2">{task.title}</h3>

                                    {task.notes && (
                                        <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                                            {task.notes}
                                        </p>
                                    )}

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50 mt-2">
                                        <div className="flex gap-2">
                                            {task.link && (
                                                <a
                                                    href={task.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-slate-400 hover:text-blue-600 transition-colors"
                                                    title="Ver enlace"
                                                >
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            )}
                                        </div>
                                        <Button
                                            size="sm"
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                            onClick={() => setActiveTaskForCompletion(task)}
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-1" />
                                            Terminar
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Completion Modal */}
            {activeTaskForCompletion && (
                <TaskCompletionModal
                    taskTitle={activeTaskForCompletion.title}
                    existingNotes={activeTaskForCompletion.notes}
                    isOpen={true}
                    onClose={() => setActiveTaskForCompletion(null)}
                    onConfirm={handleTaskCompletion}
                />
            )}
        </>
    )
}
