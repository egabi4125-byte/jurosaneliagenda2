import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarPlus,
  Clock,
  MessageCircle,
  QrCode,
  X,
  XCircle,
} from 'lucide-react';
import {
  buildWhatsAppUrl,
  formatBRL,
  formatDateBR,
  getHoursUntilAppointment,
  isFreeCancellationWindow,
} from '../lib/formatters';
import { cancelAppointmentAtomic } from '../lib/firestoreService';
import {
  APPOINTMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Appointment,
  type StudioConfig,
} from '../types';
import { PixPaymentModal } from './PixPaymentModal';

interface ClientAppointmentsTabProps {
  appointments: Appointment[];
  config: StudioConfig;
  onBookAnother: () => void;
}

export const ClientAppointmentsTab: React.FC<ClientAppointmentsTabProps> = ({
  appointments,
  config,
  onBookAnother,
}) => {
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const [pixModalState, setPixModalState] = useState<{
    open: boolean;
    amount: number;
    title: string;
    subtitle: string;
    txid: string;
    whatsappText: string;
  }>({
    open: false,
    amount: 0,
    title: '',
    subtitle: '',
    txid: 'JUNAILDESIGNER',
    whatsappText: '',
  });

  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const aKey = `${a.date}_${a.time}`;
      const bKey = `${b.date}_${b.time}`;
      return bKey.localeCompare(aKey);
    });
  }, [appointments]);

  const openPixForBookingFee = (apt: Appointment) => {
    const amount = apt.bookingFee > 0 ? apt.bookingFee : apt.servicePrice;
    const isSignal = apt.bookingFee > 0;
    setPixModalState({
      open: true,
      amount,
      title: isSignal ? 'Taxa de Reserva via Pix' : 'Pagamento via Pix',
      subtitle: `${apt.serviceName} · ${formatDateBR(apt.date)} às ${apt.time}`,
      txid: `RES${apt.date.replace(/-/g, '')}`,
      whatsappText: `Olá! Segue o comprovante do pagamento via Pix (${formatBRL(
        amount
      )}) referente ao meu agendamento de ${apt.serviceName} em ${formatDateBR(
        apt.date
      )} às ${apt.time}.`,
    });
  };

  const openPixForCancellationFee = (apt: Appointment) => {
    setPixModalState({
      open: true,
      amount: apt.cancellationFee,
      title: 'Taxa de Cancelamento via Pix',
      subtitle: `Cancelamento com menos de 2h · ${apt.serviceName} (${formatDateBR(
        apt.date
      )} às ${apt.time})`,
      txid: `CANC${apt.date.replace(/-/g, '')}`,
      whatsappText: `Olá! Segue o comprovante da taxa de cancelamento (${formatBRL(
        apt.cancellationFee
      )}) referente ao horário de ${formatDateBR(apt.date)} às ${apt.time}.`,
    });
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError('');

    const isFree = isFreeCancellationWindow(
      cancelTarget.date,
      cancelTarget.time
    );
    const feeToApply = isFree ? 0 : config.cancellationFee;

    try {
      const updated = await cancelAppointmentAtomic(cancelTarget, feeToApply);
      setCancelTarget(null);

      // Immediately open Pix modal when cancelled with < 2h and fee > 0
      if (!isFree && feeToApply > 0) {
        openPixForCancellationFee(updated);
      }
    } catch {
      setCancelError(
        'Não foi possível cancelar o horário agora. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setCancelling(false);
    }
  };

  const statusTextColor = (status: Appointment['status']) => {
    switch (status) {
      case 'confirmed':
        return 'text-[#7A2E4D] font-semibold';
      case 'completed':
        return 'text-emerald-700 font-semibold';
      case 'cancelled_free':
        return 'text-[#5E5B66] font-medium';
      case 'cancelled_fee_pending':
        return 'text-red-700 font-semibold';
      case 'cancelled_fee_paid':
        return 'text-emerald-700 font-medium';
    }
  };

  if (sortedAppointments.length === 0) {
    return (
      <div className="bg-white border border-[#E4E2E8] rounded-2xl p-10 text-center max-w-xl mx-auto">
        <Clock className="w-8 h-8 text-[#7A2E4D] mx-auto mb-3" />
        <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
          Você ainda não tem horários agendados
        </h2>
        <p className="text-sm text-[#5E5B66] mt-2 mb-6">
          Explore nossa agenda em tempo real e reserve seu atendimento de Banho
          de Gel ou Esmaltação.
        </p>
        <button
          type="button"
          onClick={onBookAnother}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-sm font-medium transition-colors cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4" />
          Agendar meu primeiro horário
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[#16141C]">
            Meus Horários
          </h2>
          <p className="text-sm text-[#5E5B66] mt-0.5">
            Acompanhe seus atendimentos, comprovantes Pix e prazos de
            cancelamento.
          </p>
        </div>
        <button
          type="button"
          onClick={onBookAnother}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <CalendarPlus className="w-4 h-4" />
          Reservar outro horário
        </button>
      </div>

      <div className="space-y-4">
        {sortedAppointments.map((apt) => {
          const hoursLeft = getHoursUntilAppointment(apt.date, apt.time);
          const freeCancel = hoursLeft >= 2;
          const isUpcoming = hoursLeft > 0;

          return (
            <article
              key={apt.id}
              className="bg-white border border-[#E4E2E8] rounded-2xl p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={statusTextColor(apt.status)}>
                      {APPOINTMENT_STATUS_LABELS[apt.status]}
                    </span>
                    <span className="text-[#E4E2E8]" aria-hidden="true">
                      |
                    </span>
                    <span className="tabular-mono text-[#16141C] font-medium">
                      {formatDateBR(apt.date)} às {apt.time}
                    </span>
                    <span className="text-[#E4E2E8]" aria-hidden="true">
                      |
                    </span>
                    <span className="text-[#5E5B66]">
                      {PAYMENT_METHOD_LABELS[apt.paymentMethod]}
                    </span>
                  </div>

                  <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                    {apt.serviceName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5E5B66]">
                    <span className="tabular-mono font-semibold text-[#16141C]">
                      {formatBRL(apt.servicePrice)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-mono">
                      {apt.serviceDuration} min
                    </span>
                    {apt.bookingFee > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>
                          Sinal:{' '}
                          <strong className="tabular-mono text-[#16141C]">
                            {formatBRL(apt.bookingFee)}
                          </strong>
                        </span>
                      </>
                    )}
                    {apt.cancellationFee > 0 && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-red-700 font-medium">
                          Taxa de cancelamento:{' '}
                          <span className="tabular-mono">
                            {formatBRL(apt.cancellationFee)}
                          </span>
                        </span>
                      </>
                    )}
                  </div>

                  {apt.notes && (
                    <p className="text-xs text-[#5E5B66] pt-1">
                      Observação: {apt.notes}
                    </p>
                  )}
                </div>

                {/* 2-hour policy indicator for confirmed appointments */}
                {apt.status === 'confirmed' && (
                  <div
                    className={`rounded-xl border px-3.5 py-2.5 text-xs max-w-xs ${
                      freeCancel
                        ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                        : 'border-amber-200 bg-amber-50/80 text-amber-900'
                    }`}
                  >
                    <p className="font-semibold">
                      {freeCancel
                        ? 'Cancelamento gratuito disponível'
                        : isUpcoming
                        ? 'Menos de 2h para o horário'
                        : 'Horário em andamento / passado'}
                    </p>
                    <p className="mt-0.5 leading-snug opacity-90">
                      {freeCancel
                        ? 'Você ainda está dentro do prazo de mais de 2h de antecedência.'
                        : `Cancelamentos agora aplicam taxa de ${formatBRL(
                            config.cancellationFee
                          )}.`}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="mt-5 pt-4 border-t border-[#E4E2E8] flex flex-wrap items-center gap-2.5">
                {apt.status === 'confirmed' && (
                  <>
                    {(apt.bookingFee > 0 || apt.paymentMethod === 'pix') && (
                      <button
                        type="button"
                        onClick={() => openPixForBookingFee(apt)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        {apt.bookingFee > 0
                          ? 'Pagar Taxa via Pix'
                          : 'QR Code Pix'}
                      </button>
                    )}

                    <a
                      href={buildWhatsAppUrl(
                        config.whatsapp,
                        `Olá! Gostaria de falar sobre meu agendamento de ${
                          apt.serviceName
                        } no dia ${formatDateBR(apt.date)} às ${apt.time}.`
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-[#16141C] text-xs font-medium transition-colors whitespace-nowrap"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-[#7A2E4D]" />
                      WhatsApp
                    </a>

                    <button
                      type="button"
                      onClick={onBookAnother}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-[#16141C] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-[#5E5B66]" />
                      Reservar outro horário
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setCancelTarget(apt);
                        setCancelError('');
                      }}
                      className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Cancelar horário
                    </button>
                  </>
                )}

                {apt.status === 'cancelled_fee_pending' &&
                  apt.cancellationFee > 0 && (
                    <button
                      type="button"
                      onClick={() => openPixForCancellationFee(apt)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Pagar Taxa via Pix (QR Code)
                    </button>
                  )}

                {apt.status !== 'confirmed' && (
                  <button
                    type="button"
                    onClick={onBookAnother}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-[#16141C] text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <CalendarPlus className="w-3.5 h-3.5 text-[#5E5B66]" />
                    Reservar outro horário
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* Cancel Confirmation Modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-[#E4E2E8] rounded-2xl p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                  Cancelar horário?
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="p-1.5 rounded-lg text-[#5E5B66] hover:text-[#16141C] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl bg-[#FAFAFA] border border-[#E4E2E8] p-3.5 text-xs space-y-1 mb-4">
              <p className="font-semibold text-[#16141C]">
                {cancelTarget.serviceName}
              </p>
              <p className="tabular-mono text-[#5E5B66]">
                {formatDateBR(cancelTarget.date)} às {cancelTarget.time}
              </p>
            </div>

            {isFreeCancellationWindow(cancelTarget.date, cancelTarget.time) ? (
              <p className="text-sm text-[#5E5B66] leading-relaxed mb-5">
                Este cancelamento é <strong className="text-emerald-700">gratuito</strong>,
                pois está sendo solicitado com mais de 2 horas de antecedência.
                O horário será liberado imediatamente na agenda.
              </p>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50/75 p-4 text-xs text-red-900 leading-relaxed mb-5">
                <p className="font-semibold">
                  Cancelamento com menos de 2h de antecedência
                </p>
                <p className="mt-1">
                  Ao confirmar, será aplicada a taxa de cancelamento de{' '}
                  <strong className="tabular-mono">
                    {formatBRL(config.cancellationFee)}
                  </strong>
                  . O QR Code Pix será aberto imediatamente na tela para
                  pagamento.
                </p>
              </div>
            )}

            {cancelError && (
              <p className="text-xs text-red-700 mb-4">{cancelError}</p>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Manter horário
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                {cancelling ? 'Cancelando...' : 'Confirmar cancelamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pix Payment Modal */}
      <PixPaymentModal
        open={pixModalState.open}
        onClose={() => setPixModalState((s) => ({ ...s, open: false }))}
        config={config}
        amount={pixModalState.amount}
        title={pixModalState.title}
        subtitle={pixModalState.subtitle}
        txid={pixModalState.txid}
        mode="client"
        whatsappPhone={config.whatsapp}
        whatsappContextText={pixModalState.whatsappText}
      />
    </div>
  );
};
