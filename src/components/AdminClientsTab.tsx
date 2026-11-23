import React, { useMemo, useState } from 'react';
import {
  Edit3,
  MessageCircle,
  Search,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import {
  adminCreateClient,
  adminDeleteClient,
  adminUpdateClient,
} from '../lib/firestoreService';
import { buildWhatsAppUrl, formatPhoneMask } from '../lib/formatters';
import type { ClientProfile } from '../types';

interface AdminClientsTabProps {
  clients: ClientProfile[];
}

export const AdminClientsTab: React.FC<AdminClientsTabProps> = ({ clients }) => {
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingClient, setEditingClient] = useState<ClientProfile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientProfile | null>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...clients]
      .filter((c) => {
        if (!q) return true;
        return `${c.name} ${c.phone} ${c.email} ${c.notes}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [clients, search]);

  const openCreate = () => {
    setModalMode('create');
    setEditingClient(null);
    setName('');
    setPhone('');
    setEmail('');
    setNotes('');
    setErrorMsg('');
  };

  const openEdit = (client: ClientProfile) => {
    setModalMode('edit');
    setEditingClient(client);
    setName(client.name);
    setPhone(client.phone);
    setEmail(client.email);
    setNotes(client.notes || '');
    setErrorMsg('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (name.trim().length < 2) {
      setErrorMsg('Informe o nome completo da cliente.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 8) {
      setErrorMsg('Informe um telefone/WhatsApp válido.');
      return;
    }

    setSaving(true);
    try {
      if (modalMode === 'create') {
        await adminCreateClient({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim(),
        });
      } else if (modalMode === 'edit' && editingClient) {
        await adminUpdateClient(editingClient.uid, {
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim(),
          notes: notes.trim(),
        });
      }
      setModalMode(null);
    } catch {
      setErrorMsg('Não foi possível salvar os dados da cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await adminDeleteClient(deleteTarget.uid);
      setDeleteTarget(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-[#E4E2E8] rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nome, WhatsApp, e-mail ou preferência..."
            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
          />
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Cadastrar Cliente
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E4E2E8] rounded-2xl p-10 text-center">
          <p className="font-serif text-2xl font-semibold text-[#16141C]">
            Nenhuma cliente encontrada
          </p>
          <p className="text-sm text-[#5E5B66] mt-1">
            Clientes cadastradas pelo aplicativo ou manualmente aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-[#E4E2E8] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E2E8] bg-[#FAFAFA] text-xs font-semibold text-[#5E5B66]">
                  <th className="py-3.5 px-5">Cliente</th>
                  <th className="py-3.5 px-4">WhatsApp</th>
                  <th className="py-3.5 px-4">E-mail</th>
                  <th className="py-3.5 px-4">Preferências / Observações</th>
                  <th className="py-3.5 px-5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E2E8] text-sm">
                {filtered.map((client) => (
                  <tr
                    key={client.uid}
                    className="hover:bg-[#FAFAFA]/80 transition-colors"
                  >
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-[#16141C]">{client.name}</p>
                      <p className="text-[11px] text-[#5E5B66]">
                        {client.isManual ? 'Cadastro manual' : 'Cadastro pelo app'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 tabular-mono text-xs text-[#16141C] whitespace-nowrap">
                      {client.phone}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#5E5B66]">
                      {client.email || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-[#5E5B66] max-w-xs">
                      {client.notes || 'Sem observações registradas'}
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center justify-end gap-1.5">
                        <a
                          href={buildWhatsAppUrl(
                            client.phone,
                            `Olá ${client.name.split(' ')[0]}! Tudo bem? Aqui é da Ju Nail Designer.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir WhatsApp"
                          className="p-2 rounded-lg border border-[#E4E2E8] hover:bg-[#FAFAFA] text-[#7A2E4D]"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => openEdit(client)}
                          title="Editar cliente"
                          className="p-2 rounded-lg border border-[#E4E2E8] hover:bg-[#FAFAFA] text-[#16141C] cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(client)}
                          title="Excluir cliente"
                          className="p-2 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Client */}
      {modalMode && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSave}
            className="w-full max-w-md bg-white border border-[#E4E2E8] rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                {modalMode === 'create' ? 'Nova Cliente' : 'Editar Cliente'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Nome completo
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Telefone / WhatsApp com DDD
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneMask(e.target.value))}
                placeholder="(11) 99999-9999"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={160}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Observações e preferências
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Formato favorito, cores preferidas, sensibilidade..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="px-4 py-2 rounded-xl border border-[#E4E2E8] text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar Cliente'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Confirm Delete Client */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#E4E2E8] rounded-2xl p-6 shadow-xl">
            <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
              Excluir cliente?
            </h3>
            <p className="text-sm text-[#5E5B66] mt-2">
              Deseja remover o cadastro de <strong>{deleteTarget.name}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#E4E2E8] text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
              >
                Excluir cadastro
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
