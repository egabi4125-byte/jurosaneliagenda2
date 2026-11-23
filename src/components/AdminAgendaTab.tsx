import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  MessageSquare,
  Plus,
  QrCode,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  adminCreateClient,
  adminDeleteAppointmentAtomic,
  adminUpdateAppointmentAtomic,
  completeAppointmentAndRecordFinance,
  confirmCancellationFeePaid,
  createAppointmentAtomic,
} from '../lib/firestoreService';
import {
  buildWhatsAppUrl,
  formatBRL,
  formatDateBR,
  formatPhoneMask,
  getTodayDateStr,
} from '../lib/formatters';
import {
  APPOINTMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Appointment,
  type ClientProfile,
  type PaymentMethod,
  type StudioConfig,
} from '../types';
import { PixPaymentModal } from './PixPaymentModal';

interface AdminAgendaTabProps {
  appointments: Appointment[];
  clients: ClientProfile[];
  config: StudioConfig;
}

type StatusFilter = 'all' | 'confirmed' | 'completed' | 'cancelled';
type TemplateType = 'reminder' | 'reschedule' | 'free';

export const AdminAgendaTab: React.FC<AdminAgendaTabProps> = ({
  appointments,
  clients,
  config,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  // Quick WhatsApp Message Modal
  const [msgTarget, setMsgTarget] = useState<Appointment | null>(null);
  const [templateType, setTemplateType] = useState<TemplateType>('reminder');
  const [customMsg, setCustomMsg] = useState('');
  const [copiedMsg, setCopiedMsg] = useState(false);

  // Pix Modal
  const [pixTarget, setPixTarget] = useState<Appointment | null>(null);
  const [pixAmount, setPixAmount] = useState(0);
  const [pixTitle, setPixTitle] = useState('');

  // Edit Appointment Modal
  const [editTarget, setEditTarget] = useState<Appointment | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editServiceId, setEditServiceId] = useState('');
  const [editPayment, setEditPayment] = useState<PaymentMethod>('pix');
  const [editBookingFeePaid, setEditBookingFeePaid] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [editError, setEditError] = useState('');

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);

  // Manual Appointment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [manualDate, setManualDate] = useState(getTodayDateStr());
  const [manualTime, setManualTime] = useState(config.workingHours[0] || '09:00');
  const [manualServiceId, setManualServiceId] = useState(config.services[0]?.id || '');
  const [manualPayment, setManualPayment] = useState<PaymentMethod>('pix');
  const [manualNotes, setManualNotes] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...appointments]
      .filter((apt) => {
        if (dateFilter && apt.date !== dateFilter) return false;
        if (statusFilter === 'confirmed' && apt.status !== 'confirmed') return false;
        if (statusFilter === 'completed' && apt.status !== 'completed') return false;
        if (
          statusFilter === 'cancelled' &&
          !apt.status.startsWith('cancelled')
        ) {
          return false;
        }
        if (q) {
          const hay =
            `${apt.clientName} ${apt.clientPhone} ${apt.serviceName} ${apt.clientEmail}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => `${b.date}_${b.time}`.localeCompare(`${a.date}_${a.time}`));
  }, [appointments, searchTerm, statusFilter, dateFilter]);

  const buildTemplateMessage = (apt: Appointment, type: TemplateType) => {
    const first = apt.clientName.split(' ')[0];
    if (type === 'reminder') {
      return `Olá ${first}! Passando para lembrar do seu horário no estúdio ${config.studioName} no dia ${formatDateBR(
        apt.date
      )} às ${apt.time} para ${apt.serviceName}. Endereço: ${config.address}. Te espero!`;
    }
    if (type === 'reschedule') {
      return `Olá ${first}, tudo bem? Aqui é do estúdio ${config.studioName}. Tivemos um pequeno imprevisto com o horário de ${formatDateBR(
        apt.date
      )} às ${apt.time} (${apt.serviceName}) e gostaríamos de verificar o melhor horário para remarcar seu atendimento.`;
    }
    return `Olá ${first}! Tudo bem? Aqui é do estúdio ${config.studioName}.`;
  };

  const openMessageModal = (apt: Appointment) => {
    setMsgTarget(apt);
    setTemplateType('reminder');
    setCustomMsg(buildTemplateMessage(apt, 'reminder'));
    setCopiedMsg(false);
  };

  const openPixModalForApt = (apt: Appointment) => {
    setPixTarget(apt);
    if (apt.status === 'cancelled_fee_pending' && apt.cancellationFee > 0) {
      setPixAmount(apt.cancellationFee);
      setPixTitle('Taxa de Cancelamento via Pix');
    } else if (apt.bookingFee > 0 && !apt.bookingFeePaid) {
      setPixAmount(apt.bookingFee);
      setPixTitle('Taxa de Reserva via Pix');
    } else {
      setPixAmount(apt.servicePrice);
      setPixTitle(`Cobrança Pix — ${apt.serviceName}`);
    }
  };

  const openEditModal = (apt: Appointment) => {
    setEditTarget(apt);
    setEditDate(apt.date);
    setEditTime(apt.time);
    setEditServiceId(apt.serviceId);
    setEditPayment(apt.paymentMethod);
    setEditBookingFeePaid(apt.bookingFeePaid);
    setEditNotes(apt.notes);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError('');
    const srv =
      config.services.find((s) => s.id === editServiceId) || {
        id: editTarget.serviceId,
        name: editTarget.serviceName,
        durationMinutes: editTarget.serviceDuration,
        price: editTarget.servicePrice,
      };
    setBusyId(editTarget.id);
    try {
      await adminUpdateAppointmentAtomic(editTarget, {
        date: editDate,
        time: editTime,
        service: srv,
        paymentMethod: editPayment,
        notes: editNotes,
        bookingFeePaid: editBookingFeePaid,
      });
      setEditTarget(null);
      setFeedback('Agendamento atualizado com sucesso.');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SLOT_TAKEN') {
        setEditError('O novo horário selecionado já está ocupado.');
      } else {
        setEditError('Erro ao atualizar agendamento.');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleComplete = async (apt: Appointment) => {
    setBusyId(apt.id);
    setFeedback('');
    try {
      await completeAppointmentAndRecordFinance(apt);
      setFeedback(
        `Atendimento de ${apt.clientName} concluído e lançado no Financeiro (${formatBRL(
          apt.servicePrice
        )}).`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmFeePaid = async (apt: Appointment) => {
    setBusyId(apt.id);
    setFeedback('');
    try {
      await confirmCancellationFeePaid(apt, 'pix');
      setFeedback(
        `Taxa de cancelamento de ${apt.clientName} (${formatBRL(
          apt.cancellationFee
        )}) quitada e lançada no Financeiro.`
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    try {
      await adminDeleteAppointmentAtomic(deleteTarget);
      setDeleteTarget(null);
      setFeedback('Agendamento excluído e horário liberado na agenda.');
    } finally {
      setBusyId(null);
    }
  };

  const handleManualCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const srv = config.services.find((s) => s.id === manualServiceId) || config.services[0];
    if (!srv) {
      setCreateError('Cadastre ao menos um procedimento em Salão & Pix.');
      return;
    }

    setCreating(true);
    try {
      let cId = '';
      let cName = '';
      let cPhone = '';
      let cEmail = '';

      if (clientMode === 'existing') {
        const found = clients.find((c) => c.uid === selectedClientId);
        if (!found) {
          setCreateError('Selecione uma cliente cadastrada ou mude para "Nova cliente".');
          setCreating(false);
          return;
        }
        cId = found.uid;
        cName = found.name;
        cPhone = found.phone;
        cEmail = found.email;
      } else {
        if (newClientName.trim().length < 2 || newClientPhone.replace(/\D/g, '').length < 8) {
          setCreateError('Informe nome e telefone válido da nova cliente.');
          setCreating(false);
          return;
        }
        const createdClient = await adminCreateClient({
          name: newClientName.trim(),
          phone: newClientPhone.trim(),
          email: newClientEmail.trim(),
          notes: '',
        });
        cId = createdClient.uid;
        cName = createdClient.name;
        cPhone = createdClient.phone;
        cEmail = createdClient.email;
      }

      await createAppointmentAtomic({
        clientId: cId,
        clientName: cName,
        clientPhone: cPhone,
        clientEmail: cEmail,
        date: manualDate,
        time: manualTime,
        service: srv,
        bookingFee: config.bookingFee,
        paymentMethod: manualPayment,
        notes: manualNotes.trim(),
        createdBy: 'admin',
      });

      setShowCreateModal(false);
      setNewClientName('');
      setNewClientPhone('');
      setNewClientEmail('');
      setManualNotes('');
      setFeedback(`Agendamento manual criado para ${cName} em ${formatDateBR(manualDate)} às ${manualTime}.`);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SLOT_TAKEN') {
        setCreateError('Este horário já está reservado. Escolha outro horário.');
      } else {
        setCreateError('Não foi possível criar o agendamento manual.');
      }
    } finally {
      setCreating(false);
    }
  };

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(customMsg);
    } catch {
      // fallback ignored
    }
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const statusTone = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed':
        return 'text-[#7A2E4D] font-semibold';
      case 'completed':
        return 'text-emerald-700 font-semibold';
      case 'cancelled_fee_pending':
        return 'text-red-700 font-semibold';
      case 'cancelled_fee_paid':
        return 'text-emerald-700 font-medium';
      default:
        return 'text-[#5E5B66] font-medium';
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar: Search, Status Segmented Filter, Date Filter, Manual Booking CTA */}
      <div className="bg-white border border-[#E4E2E8] rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-[#5E5B66] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por cliente, telefone ou procedimento..."
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-xs text-[#16141C]"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="px-2.5 py-2.5 rounded-xl border border-[#E4E2E8] text-xs text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
              >
                Limpar
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowCreateModal(true);
              setCreateError('');
              setSelectedClientId(clients[0]?.uid || '');
              setManualServiceId(config.services[0]?.id || '');
              setManualTime(config.workingHours[0] || '09:00');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Novo Agendamento
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {(
            [
              { id: 'all', label: 'Todos' },
              { id: 'confirmed', label: 'Confirmados' },
              { id: 'completed', label: 'Concluídos' },
              { id: 'cancelled', label: 'Cancelados' },
            ] as { id: StatusFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                statusFilter === f.id
                  ? 'bg-[#7A2E4D] text-white'
                  : 'bg-[#FAFAFA] text-[#5E5B66] hover:text-[#16141C] border border-[#E4E2E8]'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-[#5E5B66] tabular-mono">
            {filtered.length} registro{filtered.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback('')}
            className="text-emerald-800 hover:underline cursor-pointer"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Appointments List */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E4E2E8] rounded-2xl p-10 text-center">
          <p className="font-serif text-2xl font-semibold text-[#16141C]">
            Nenhum agendamento encontrado
          </p>
          <p className="text-sm text-[#5E5B66] mt-1">
            Ajuste os filtros acima ou cadastre um novo horário manualmente.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((apt) => (
            <article
              key={apt.id}
              className="bg-white border border-[#E4E2E8] rounded-2xl p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={statusTone(apt.status)}>
                      {APPOINTMENT_STATUS_LABELS[apt.status]}
                    </span>
                    <span className="text-[#E4E2E8]">|</span>
                    <span className="tabular-mono font-semibold text-[#16141C]">
                      {formatDateBR(apt.date)} às {apt.time}
                    </span>
                    <span className="text-[#E4E2E8]">|</span>
                    <span className="text-[#5E5B66]">
                      {PAYMENT_METHOD_LABELS[apt.paymentMethod]}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                    {apt.clientName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5E5B66]">
                    <span className="font-medium text-[#16141C]">
                      {apt.serviceName}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-mono font-semibold text-[#7A2E4D]">
                      {formatBRL(apt.servicePrice)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-mono">{apt.clientPhone}</span>
                    {apt.clientEmail && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{apt.clientEmail}</span>
                      </>
                    )}
                  </div>

                  {apt.notes && (
                    <p className="text-xs text-[#5E5B66] pt-1">
                      Obs.: {apt.notes}
                    </p>
                  )}

                  {apt.status === 'cancelled_fee_pending' &&
                    apt.cancellationFee > 0 && (
                      <p className="text-xs text-red-700 font-medium pt-1">
                        Taxa de cancelamento pendente:{' '}
                        <span className="tabular-mono">
                          {formatBRL(apt.cancellationFee)}
                        </span>
                      </p>
                    )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-4 pt-4 border-t border-[#E4E2E8] flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openMessageModal(apt)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] whitespace-nowrap cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[#7A2E4D]" />
                  Mensagem Pronta
                </button>

                <button
                  type="button"
                  onClick={() => openPixModalForApt(apt)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#7A2E4D]/30 bg-[#F7EFF2] hover:bg-[#EFE0E6] text-xs font-medium text-[#7A2E4D] whitespace-nowrap cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  {apt.status === 'cancelled_fee_pending'
                    ? 'QR Code Taxa'
                    : 'QR Code Pix'}
                </button>

                {apt.status === 'confirmed' && (
                  <button
                    type="button"
                    disabled={busyId === apt.id}
                    onClick={() => handleComplete(apt)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Concluir e Receber
                  </button>
                )}

                {apt.status === 'cancelled_fee_pending' && (
                  <button
                    type="button"
                    disabled={busyId === apt.id}
                    onClick={() => handleConfirmFeePaid(apt)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-medium whitespace-nowrap cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Confirmar Taxa Paga
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openEditModal(apt)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] whitespace-nowrap cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-[#5E5B66]" />
                  Alterar
                </button>

                <button
                  type="button"
                  onClick={() => setDeleteTarget(apt)}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-medium text-red-700 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Modal: Mensagem Pronta WhatsApp */}
      {msgTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-white border border-[#E4E2E8] rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                  Mensagem Pronta — {msgTarget.clientName}
                </h3>
                <p className="text-xs text-[#5E5B66] tabular-mono mt-0.5">
                  {msgTarget.clientPhone}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMsgTarget(null)}
                className="p-1.5 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'reminder', label: 'Lembrete de horário' },
                  { id: 'reschedule', label: 'Imprevisto / Remarcação' },
                  { id: 'free', label: 'Conversa livre' },
                ] as { id: TemplateType; label: string }[]
              ).map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setTemplateType(tpl.id);
                    setCustomMsg(buildTemplateMessage(msgTarget, tpl.id));
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    templateType === tpl.id
                      ? 'bg-[#7A2E4D] text-white border-[#7A2E4D]'
                      : 'bg-[#FAFAFA] text-[#16141C] border-[#E4E2E8]'
                  }`}
                >
                  {tpl.label}
                </button>
              ))}
            </div>

            <textarea
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              rows={5}
              className="w-full p-3.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C] leading-relaxed"
            />

            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={copyMessage}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] cursor-pointer"
              >
                {copiedMsg ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar texto
                  </>
                )}
              </button>
              <a
                href={buildWhatsAppUrl(msgTarget.clientPhone, customMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-semibold"
              >
                <Send className="w-4 h-4" />
                Enviar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Code Pix / Taxa for Appointment */}
      {pixTarget && (
        <PixPaymentModal
          open={Boolean(pixTarget)}
          onClose={() => setPixTarget(null)}
          config={config}
          amount={pixAmount}
          title={pixTitle}
          subtitle={`${pixTarget.clientName} · ${pixTarget.serviceName} (${formatDateBR(
            pixTarget.date
          )} às ${pixTarget.time})`}
          txid={`APT${pixTarget.date.replace(/-/g, '')}`}
          mode="admin"
          whatsappPhone={pixTarget.clientPhone}
          amountOptions={[
            ...(config.bookingFee > 0
              ? [
                  {
                    label: `Taxa de Reserva (${formatBRL(config.bookingFee)})`,
                    amount: config.bookingFee,
                  },
                ]
              : []),
            ...(config.cancellationFee > 0
              ? [
                  {
                    label: `Taxa Cancelamento (${formatBRL(
                      pixTarget.cancellationFee || config.cancellationFee
                    )})`,
                    amount: pixTarget.cancellationFee || config.cancellationFee,
                  },
                ]
              : []),
            {
              label: `Valor do Atendimento (${formatBRL(
                pixTarget.servicePrice
              )})`,
              amount: pixTarget.servicePrice,
            },
          ]}
          onSelectAmount={(amt, label) => {
            setPixAmount(amt);
            setPixTitle(label);
          }}
        />
      )}

      {/* Modal: Alterar Agendamento */}
      {editTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-lg bg-white border border-[#E4E2E8] rounded-2xl p-6 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                Alterar agendamento — {editTarget.clientName}
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="p-1.5 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {editError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Horário
                </label>
                <select
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
                >
                  {Array.from(new Set([...config.workingHours, editTime]))
                    .sort()
                    .map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Procedimento
                </label>
                <select
                  value={editServiceId}
                  onChange={(e) => setEditServiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                >
                  {config.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatBRL(s.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Forma de pagamento
                </label>
                <select
                  value={editPayment}
                  onChange={(e) => setEditPayment(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                >
                  {(
                    ['pix', 'credit', 'debit', 'cash'] as PaymentMethod[]
                  ).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-[#16141C] cursor-pointer">
              <input
                type="checkbox"
                checked={editBookingFeePaid}
                onChange={(e) => setEditBookingFeePaid(e.target.checked)}
                className="accent-[#7A2E4D] w-4 h-4"
              />
              Taxa de reserva / sinal já pago
            </label>

            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Observações
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="px-4 py-2 rounded-xl border border-[#E4E2E8] text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busyId === editTarget.id}
                className="px-4 py-2 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-semibold cursor-pointer"
              >
                Salvar alterações
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Excluir Agendamento */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#E4E2E8] rounded-2xl p-6 shadow-xl">
            <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
              Excluir agendamento?
            </h3>
            <p className="text-sm text-[#5E5B66] mt-2">
              O agendamento de <strong>{deleteTarget.clientName}</strong> em{' '}
              <span className="tabular-mono">
                {formatDateBR(deleteTarget.date)} às {deleteTarget.time}
              </span>{' '}
              será removido e o horário voltará a ficar livre na agenda.
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
                disabled={busyId === deleteTarget.id}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs font-semibold cursor-pointer"
              >
                Confirmar exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Cadastrar Agendamento Manual */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleManualCreate}
            className="w-full max-w-lg bg-white border border-[#E4E2E8] rounded-2xl p-6 my-8 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                Novo Agendamento Manual
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#FAFAFA] border border-[#E4E2E8]">
              <button
                type="button"
                onClick={() => setClientMode('existing')}
                className={`py-2 rounded-lg text-xs font-medium cursor-pointer ${
                  clientMode === 'existing'
                    ? 'bg-white text-[#16141C] border border-[#E4E2E8]'
                    : 'text-[#5E5B66]'
                }`}
              >
                Cliente cadastrada
              </button>
              <button
                type="button"
                onClick={() => setClientMode('new')}
                className={`py-2 rounded-lg text-xs font-medium cursor-pointer ${
                  clientMode === 'new'
                    ? 'bg-white text-[#16141C] border border-[#E4E2E8]'
                    : 'text-[#5E5B66]'
                }`}
              >
                Nova cliente
              </button>
            </div>

            {clientMode === 'existing' ? (
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Selecionar cliente
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                  required
                >
                  {clients.length === 0 ? (
                    <option value="">Nenhuma cliente cadastrada</option>
                  ) : (
                    clients.map((c) => (
                      <option key={c.uid} value={c.uid}>
                        {c.name} — {c.phone}
                      </option>
                    ))
                  )}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#16141C] mb-1">
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={newClientName}
                    onChange={(e) => setNewClientName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-[#16141C] mb-1">
                      WhatsApp com DDD
                    </label>
                    <input
                      type="tel"
                      value={newClientPhone}
                      onChange={(e) =>
                        setNewClientPhone(formatPhoneMask(e.target.value))
                      }
                      placeholder="(11) 99999-9999"
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#16141C] mb-1">
                      E-mail (opcional)
                    </label>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={(e) => setNewClientEmail(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Data
                </label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Horário
                </label>
                <select
                  value={manualTime}
                  onChange={(e) => setManualTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
                >
                  {config.workingHours.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Procedimento
                </label>
                <select
                  value={manualServiceId}
                  onChange={(e) => setManualServiceId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                >
                  {config.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({formatBRL(s.price)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Pagamento
                </label>
                <select
                  value={manualPayment}
                  onChange={(e) =>
                    setManualPayment(e.target.value as PaymentMethod)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
                >
                  {(
                    ['pix', 'credit', 'debit', 'cash'] as PaymentMethod[]
                  ).map((m) => (
                    <option key={m} value={m}>
                      {PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Observações
              </label>
              <textarea
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl border border-[#E4E2E8] text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {creating ? 'Salvando...' : 'Criar Agendamento'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
