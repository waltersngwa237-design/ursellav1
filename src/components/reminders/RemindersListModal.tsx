import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Calendar,
  Clock,
  AlertCircle,
  Tag,
} from 'lucide-react';
import type { BusinessReminder } from '../../types/proactive.ts';
import { ProactiveService } from '../../services/proactive.service.ts';
import { useAuth } from '../../contexts/AuthContext.tsx';
import { useBusiness } from '../../contexts/BusinessContext.tsx';

interface RemindersListModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: BusinessReminder[];
  onRefresh: () => void;
}

export const RemindersListModal: React.FC<RemindersListModalProps> = ({
  isOpen,
  onClose,
  reminders,
  onRefresh,
}) => {
  const { user } = useAuth();
  const { activeBusiness } = useBusiness();
  const currentBusiness = activeBusiness;
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleToggleComplete = async (rem: BusinessReminder) => {
    if (!currentBusiness) return;
    const nextStatus = rem.status === 'completed' ? 'pending' : 'completed';
    await ProactiveService.updateReminderStatus(rem.id, currentBusiness.id, nextStatus);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!currentBusiness) return;
    await ProactiveService.deleteReminder(id, currentBusiness.id);
    onRefresh();
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBusiness || !user || !newTitle.trim()) return;

    setLoading(true);
    await ProactiveService.createReminder({
      businessId: currentBusiness.id,
      userId: user.id,
      title: newTitle.trim(),
      dueDate: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      priority: newPriority,
    });

    setNewTitle('');
    setNewDueDate('');
    setShowAddForm(false);
    setLoading(false);
    onRefresh();
  };

  const pendingReminders = reminders.filter((r) => r.status === 'pending');
  const completedReminders = reminders.filter((r) => r.status === 'completed');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div
        id="reminders-modal"
        className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Business Tasks & Reminders
              </h3>
              <p className="text-xs text-slate-400">
                Operational action items and follow-up deadlines
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Add Reminder Button/Form */}
          {!showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 transition-all flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Task or Reminder
            </button>
          ) : (
            <form onSubmit={handleCreate} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                New Task / Reminder
              </h4>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What needs to be done? (e.g. Call supplier for Blue Shirts)"
                required
                className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Due Date</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-500 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="high">High Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !newTitle.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl"
                >
                  Save Task
                </button>
              </div>
            </form>
          )}

          {/* Pending Tasks */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Active Tasks ({pendingReminders.length})
            </h4>

            {pendingReminders.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                No active tasks. You are all caught up!
              </div>
            ) : (
              pendingReminders.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(r)}
                      className="text-slate-400 hover:text-emerald-500 transition-colors"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                      <h5 className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {r.title}
                      </h5>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        {r.due_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(r.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {r.related_entity_name && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {r.related_entity_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded transition-colors"
                    title="Delete reminder"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Completed Tasks */}
          {completedReminders.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Completed ({completedReminders.length})
              </h4>
              {completedReminders.map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 flex items-center justify-between gap-3 opacity-60"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(r)}
                      className="text-emerald-500"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs text-slate-600 dark:text-slate-400 line-through truncate">
                      {r.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
