// src/app/users/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import {
  UserCheck,
  Plus,
  Mail,
  Shield,
  Briefcase,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';
import { formatRoleLabel, type UserRole } from '@/lib/auth/permissions';

interface AssignedClient {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  memberId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  role: UserRole;
  status: 'active' | 'invited';
  lastSignIn: string | null;
  assignedClients: AssignedClient[];
}

interface ClientOption {
  id: string;
  name: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [allClients, setAllClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modais
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form State para Adicionar/Editar
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('designer');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsersAndClients = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, clientsRes] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/clients'),
      ]);

      if (!usersRes.ok) {
        const data = await usersRes.json();
        throw new Error(data.error?.message || 'Falha ao carregar usuários.');
      }

      const usersData = await usersRes.json();
      setUsers(usersData.users || []);

      if (clientsRes.ok) {
        const clientsData = await clientsRes.json();
        setAllClients(clientsData.clients || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar dados da equipe.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAndClients();
  }, []);

  const openAddModal = () => {
    setFormName('');
    setFormEmail('');
    setFormRole('designer');
    setSelectedClientIds([]);
    setFormError(null);
    setIsAddOpen(true);
  };

  const openEditModal = (u: UserItem) => {
    setEditingUser(u);
    setFormName(u.fullName);
    setFormEmail(u.email);
    setFormRole(u.role);
    setSelectedClientIds(u.assignedClients.map((c) => c.id));
    setFormError(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formName,
          email: formEmail,
          role: formRole,
          clientIds: selectedClientIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao convidar usuário.');
      }

      setIsAddOpen(false);
      fetchUsersAndClients();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar novo usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSaving(true);
    setFormError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: editingUser.memberId,
          targetUserId: editingUser.id,
          fullName: formName,
          role: formRole,
          clientIds: selectedClientIds,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao atualizar usuário.');
      }

      setEditingUser(null);
      fetchUsersAndClients();
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao editar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubmit = async () => {
    if (!deletingUser) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users?memberId=${deletingUser.memberId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Falha ao remover acesso do usuário.');
      }

      setDeletingUser(null);
      fetchUsersAndClients();
    } catch (err: any) {
      alert(err?.message || 'Erro ao remover usuário.');
    } finally {
      setSaving(false);
    }
  };

  const toggleClientSelection = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-canvas-bg font-sans">
      <AppSidebar />

      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <UserCheck className="w-6 h-6 text-fa-green" />
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Usuários</h1>
            </div>
            <p className="text-sm text-gray-500">
              Gerencie sua equipe, permissões e clientes atribuídos a cada colaborador.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 bg-fa-dark hover:bg-black text-white text-sm font-semibold rounded-xl transition-colors shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4 text-fa-green" />
            <span>Adicionar usuário</span>
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Lista de Usuários */}
        <div className="bg-canvas-card border border-canvas-border rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-fa-green" />
              <p className="text-sm">Carregando usuários da equipe...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              Nenhum colaborador encontrado na organização.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-canvas-border bg-gray-50/50 text-gray-600 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-5">Colaborador</th>
                    <th className="py-3.5 px-5">Cargo</th>
                    <th className="py-3.5 px-5">Clientes Atribuídos</th>
                    <th className="py-3.5 px-5">Status</th>
                    <th className="py-3.5 px-5">Último Acesso</th>
                    <th className="py-3.5 px-5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-canvas-border">
                  {users.map((u) => {
                    const isAdm = u.role === 'owner' || u.role === 'admin';
                    const initials =
                      u.fullName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((s) => s[0].toUpperCase())
                        .join('') || 'U';

                    return (
                      <tr key={u.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-fa-dark text-white font-bold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{u.fullName}</p>
                              <p className="text-xs text-gray-500">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                              u.role === 'owner'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : u.role === 'admin'
                                ? 'bg-fa-green/20 text-gray-900 border border-fa-green/40'
                                : u.role === 'designer'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {formatRoleLabel(u.role)}
                          </span>
                        </td>

                        <td className="py-4 px-5">
                          {isAdm ? (
                            <span className="text-xs text-gray-500 font-medium italic">
                              Acesso total a todos os clientes
                            </span>
                          ) : u.assignedClients.length === 0 ? (
                            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              Nenhum cliente atribuído
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-xs">
                              {u.assignedClients.slice(0, 3).map((c) => (
                                <span
                                  key={c.id}
                                  className="text-[11px] bg-white border border-gray-200 px-2 py-0.5 rounded-md font-medium text-gray-700 truncate"
                                >
                                  {c.name}
                                </span>
                              ))}
                              {u.assignedClients.length > 3 && (
                                <span className="text-[11px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                                  +{u.assignedClients.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-4 px-5">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              u.status === 'active' ? 'text-green-600' : 'text-amber-600'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'active' ? 'bg-green-500' : 'bg-amber-500'
                              }`}
                            />
                            {u.status === 'active' ? 'Ativo' : 'Pendente'}
                          </span>
                        </td>

                        <td className="py-4 px-5 text-xs text-gray-500">
                          {u.lastSignIn
                            ? new Date(u.lastSignIn).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Nunca acessou'}
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditModal(u)}
                              title="Editar usuário"
                              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingUser(u)}
                              title="Remover acesso"
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal: Adicionar Usuário */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">Adicionar Colaborador</h3>
                <button
                  onClick={() => setIsAddOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="João Silva"
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    E-mail (convite será enviado)
                  </label>
                  <input
                    type="email"
                    required
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="joao@agenciafa.com.br"
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo / Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
                  >
                    <option value="designer">Designer (Acessa clientes atribuídos)</option>
                    <option value="admin">Administrador (Acessa toda a operação)</option>
                    <option value="viewer">Visualizador (Somente leitura)</option>
                  </select>
                </div>

                {formRole !== 'admin' && formRole !== 'owner' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Clientes Atribuídos
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2.5 space-y-1.5 bg-gray-50">
                      {allClients.length === 0 ? (
                        <p className="text-xs text-gray-400">Nenhum cliente cadastrado.</p>
                      ) : (
                        allClients.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 text-xs text-gray-700 hover:bg-white p-1.5 rounded-lg cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedClientIds.includes(c.id)}
                              onChange={() => toggleClientSelection(c.id)}
                              className="rounded text-fa-green focus:ring-fa-green"
                            />
                            <span>{c.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-white bg-fa-dark hover:bg-black rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Enviar Convite</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Editar Usuário */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <h3 className="font-bold text-lg text-gray-900">Editar Colaborador</h3>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    disabled
                    value={formEmail}
                    className="w-full px-3.5 py-2 text-sm bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Cargo / Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fa-green/50 text-gray-900"
                  >
                    {editingUser.role === 'owner' && <option value="owner">Owner (Proprietário)</option>}
                    <option value="admin">Administrador (Acessa toda a operação)</option>
                    <option value="designer">Designer (Acessa clientes atribuídos)</option>
                    <option value="viewer">Visualizador (Somente leitura)</option>
                  </select>
                </div>

                {formRole !== 'admin' && formRole !== 'owner' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Clientes Atribuídos
                    </label>
                    <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2.5 space-y-1.5 bg-gray-50">
                      {allClients.length === 0 ? (
                        <p className="text-xs text-gray-400">Nenhum cliente cadastrado.</p>
                      ) : (
                        allClients.map((c) => (
                          <label
                            key={c.id}
                            className="flex items-center gap-2.5 text-xs text-gray-700 hover:bg-white p-1.5 rounded-lg cursor-pointer transition"
                          >
                            <input
                              type="checkbox"
                              checked={selectedClientIds.includes(c.id)}
                              onChange={() => toggleClientSelection(c.id)}
                              className="rounded text-fa-green focus:ring-fa-green"
                            />
                            <span>{c.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-white bg-fa-dark hover:bg-black rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Confirmar Remoção de Acesso */}
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-gray-900">Remover Acesso do Usuário</h3>
                  <p className="text-xs text-gray-500">Revogação de permissões na organização</p>
                </div>
              </div>

              <p className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200 leading-relaxed mb-4">
                Deseja revogar o acesso de <strong>{deletingUser.fullName}</strong> ({deletingUser.email})?
                O colaborador perderá acesso a todos os clientes e projetos. Seus trabalhos anteriores serão preservados.
              </p>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDeleteSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Remover Acesso</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
