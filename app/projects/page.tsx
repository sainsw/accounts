'use client';

import { useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { Card, PageHeader, StatCard } from '@/components/Card';
import { Modal } from '@/components/Modal';
import { formatCurrency, todayString } from '@/lib/utils';
import type { Project } from '@/lib/types';

type ProjectForm = {
  name: string;
  clientId: string | null;
  description: string;
  active: boolean;
};

const emptyForm: ProjectForm = { name: '', clientId: null, description: '', active: true };

export default function ProjectsPage() {
  const { settings, projects, addProject, updateProject, deleteProject, transactions, clients, invoices } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(emptyForm);
  const [showInactive, setShowInactive] = useState(false);

  const sym = settings.currencySymbol || '£';

  const projectStats = useMemo(() => {
    const stats: Record<string, { income: number; costs: number; invoiced: number }> = {};
    for (const p of projects) {
      stats[p.id] = { income: 0, costs: 0, invoiced: 0 };
    }
    for (const t of transactions) {
      if (t.projectId && stats[t.projectId]) {
        if (t.type === 'income') stats[t.projectId].income += t.amount;
        else stats[t.projectId].costs += t.amount;
      }
    }
    return stats;
  }, [projects, transactions]);

  const visibleProjects = projects.filter((p) => showInactive || p.active);
  const totalIncome = Object.values(projectStats).reduce((s, p) => s + p.income, 0);
  const totalCosts = Object.values(projectStats).reduce((s, p) => s + p.costs, 0);

  function handleSave() {
    if (!form.name.trim()) return;
    if (editing) {
      updateProject({ ...editing, ...form });
    } else {
      addProject(form);
    }
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  }

  return (
    <>
      <PageHeader title="Projects" description="Track profitability per project or job" />

      <div className="mb-4 grid grid-cols-3 gap-4">
        <StatCard label="Active Projects" value={String(projects.filter((p) => p.active).length)} color="blue" />
        <StatCard label="Total Revenue" value={formatCurrency(totalIncome, sym)} color="green" />
        <StatCard label="Total Profit" value={formatCurrency(totalIncome - totalCosts, sym)} color={totalIncome - totalCosts >= 0 ? 'green' : 'red'} />
      </div>

      <div className="mb-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded" />
          Show inactive
        </label>
        <button onClick={() => { setForm(emptyForm); setEditing(null); setShowModal(true); }} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
          + New Project
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibleProjects.map((project) => {
          const stats = projectStats[project.id] || { income: 0, costs: 0 };
          const client = clients.find((c) => c.id === project.clientId);
          const net = stats.income - stats.costs;

          return (
            <Card key={project.id} className={!project.active ? 'opacity-60' : ''}>
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">{project.name}</h3>
                  {client && <p className="text-xs text-slate-500">{client.name}</p>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${project.active ? 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                  {project.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {project.description && <p className="mb-3 text-xs text-slate-500">{project.description}</p>}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 dark:border-slate-700/60">
                <div>
                  <p className="text-xs text-slate-500">Revenue</p>
                  <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(stats.income, sym)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Costs</p>
                  <p className="text-sm font-medium text-red-600 dark:text-red-400">{formatCurrency(stats.costs, sym)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Profit</p>
                  <p className={`text-sm font-medium ${net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(net, sym)}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => { setEditing(project); setForm({ name: project.name, clientId: project.clientId, description: project.description, active: project.active }); setShowModal(true); }} className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                  Edit
                </button>
                <button onClick={() => deleteProject(project.id)} className="text-xs text-red-500 hover:text-red-700">
                  Delete
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {visibleProjects.length === 0 && (
        <Card>
          <p className="py-8 text-center text-sm text-slate-500">No projects yet. Create a project to track profitability per job.</p>
        </Card>
      )}

      {showModal && (
        <Modal open={showModal} title={editing ? 'Edit Project' : 'New Project'} onClose={() => setShowModal(false)}>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Project Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Website Redesign" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Client (optional)</label>
              <select value={form.clientId || ''} onChange={(e) => setForm({ ...form, clientId: e.target.value || null })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">No client</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            {editing && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="rounded" />
                Active
              </label>
            )}
            <button onClick={handleSave} className="w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600">
              {editing ? 'Update' : 'Create'} Project
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
