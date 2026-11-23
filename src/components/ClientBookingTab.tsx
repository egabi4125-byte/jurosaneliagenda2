import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Mail,
  MapPin,
  Send,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import {
  buildSlotId,
  buildWhatsAppUrl,
  formatBRL,
  formatDateBR,
  formatDateLongBR,
  formatMonthYearBR,
  formatPhoneMask,
  getMonthGrid,
  getTodayDateStr,
  isDateFullyPast,
  isDayClosedByClosures,
  isSlotClosedByClosures,
  isSlotInPast,
} from '../lib/formatters';
import {
  createAppointmentAtomic,
  updateOwnClientProfile,
} from '../lib/firestoreService';
import {
  PAYMENT_METHOD_LABELS,
  type Appointment,
  type ClientDayLock,
  type ClientProfile,
  type Closure,
  type PaymentMethod,
  type SlotDoc,
  type StudioConfig,
} from '../types';
import { PixPaymentCard } from './PixPaymentCard';

interface ClientBookingTabProps {
  user: User;
  clientProfile: ClientProfile | null;
  config: StudioConfig;
  slots: SlotDoc[];
  closures: Closure[];
  dayLocks: ClientDayLock[];
  onGoToAppointments: () => void;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export const ClientBookingTab: React.FC<ClientBookingTabProps> = ({
  user,
  clientProfile,
  config,
  slots,
  closures,
  dayLocks,
  onGoToAppointments,
}) => {
  const todayStr = getTodayDateStr();
  const initialDate = new Date();

  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedTime, setSelectedTime] = useState<string>('');

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    config.services[0]?.id || ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [clientName, setClientName] = useState(
    clientProfile?.name || user.displayName || ''
  );
  const [clientPhone, setClientPhone] = useState(
    clientProfile?.phone && clientProfile.phone !== '(00) 00000-0000'
      ? clientProfile.phone
      : ''
  );
  const [clientEmail, setClientEmail] = useState(
    clientProfile?.email || user.email || ''
  );
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedApt, setConfirmedApt] = useState<Appointment | null>(null);

  useEffect(() => {
    if (clientProfile) {
      if (!clientName && clientProfile.name) setClientName(clientProfile.name);
      if (
        !clientPhone &&
        clientProfile.phone &&
        clientProfile.phone !== '(00) 00000-0000'
      ) {
        setClientPhone(clientProfile.phone);
      }
      if (!clientEmail && clientProfile.email) {
        setClientEmail(clientProfile.email);
      }
    }
  }, [clientProfile]);

  useEffect(() => {
    if (
      config.services.length > 0 &&
      !config.services.some((s) => s.id === selectedServiceId)
    ) {
      setSelectedServiceId(config.services[0].id);
    }
  }, [config.services, selectedServiceId]);

  const bookedSlotSet = useMemo(() => {
    const map = new Map<string, SlotDoc>();
    slots.forEach((s) => map.set(s.id, s));
    return map;
  }, [slots]);

  const clientLockedDates = useMemo(() => {
    const set = new Set<string>();
    dayLocks.forEach((l) => {
      if (l.clientId === user.uid) {
        set.add(l.date);
      }
    });
    return set;
  }, [dayLocks, user.uid]);

  const calendarCells = useMemo(
    () => getMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const getDaySummary = (dateStr: string) => {
    const hasClientBooking = clientLockedDates.has(dateStr);
    const dayClosure = isDayClosedByClosures(dateStr, closures);
    const pastDate = isDateFullyPast(dateStr);

    if (pastDate) {
      return {
        state: 'past' as const,
        label: 'Encerrado',
        freeCount: 0,
        hasClientBooking,
      };
    }

    if (dayClosure) {
      return {
        state: 'closed' as const,
        label: 'Fechada',
        freeCount: 0,
        reason: dayClosure.reason,
        hasClientBooking,
      };
    }

    let freeCount = 0;
    let remainingNonPastCount = 0;

    for (const time of config.workingHours) {
      if (isSlotInPast(dateStr, time)) continue;
      remainingNonPastCount++;
      const slotClosed = isSlotClosedByClosures(dateStr, time, closures);
      const slotBooked = bookedSlotSet.has(buildSlotId(dateStr, time));
      if (!slotClosed && !slotBooked) {
        freeCount++;
      }
    }

    if (hasClientBooking) {
      return {
        state: 'reserved' as const,
        label: 'Reservado',
        freeCount,
        hasClientBooking: true,
      };
    }

    if (remainingNonPastCount === 0) {
      return {
        state: 'past' as const,
        label: 'Encerrado',
        freeCount: 0,
        hasClientBooking: false,
      };
    }

    if (freeCount === 0) {
      return {
        state: 'full' as const,
        label: 'Lotado',
        freeCount: 0,
        hasClientBooking: false,
      };
    }

    return {
      state: 'open' as const,
      label: freeCount === 1 ? '1 vaga' : `${freeCount} vagas`,
      freeCount,
      hasClientBooking: false,
    };
  };

  const selectedDaySummary = useMemo(
    () => getDaySummary(selectedDate),
    [selectedDate, config.workingHours, closures, bookedSlotSet, clientLockedDates]
  );

  const selectedDayClosure = useMemo(
    () => isDayClosedByClosures(selectedDate, closures),
    [selectedDate, closures]
  );

  const clientAlreadyBookedSelectedDay = clientLockedDates.has(selectedDate);

  const slotStatuses = useMemo(() => {
    return config.workingHours.map((time) => {
      const slotId = buildSlotId(selectedDate, time);
      const past = isSlotInPast(selectedDate, time);
      const closure = isSlotClosedByClosures(selectedDate, time, closures);
      const slotDoc = bookedSlotSet.get(slotId);
      const isMine = slotDoc?.clientId === user.uid;

      if (past) {
        return { time, status: 'past' as const, label: 'Encerrado' };
      }
      if (closure) {
        return {
          time,
          status: 'closed' as const,
          label: 'Fechado',
          reason: closure.reason,
        };
      }
      if (slotDoc) {
        return {
          time,
          status: isMine ? ('mine' as const) : ('occupied' as const),
          label: isMine ? 'Seu horário' : 'Ocupado',
        };
      }
      return { time, status: 'available' as const, label: 'Disponível' };
    });
  }, [selectedDate, config.workingHours, closures, bookedSlotSet, user.uid]);

  useEffect(() => {
    if (selectedTime) {
      const current = slotStatuses.find((s) => s.time === selectedTime);
      if (!current || current.status !== 'available' || clientAlreadyBookedSelectedDay) {
        setSelectedTime('');
      }
    }
  }, [slotStatuses, selectedTime, clientAlreadyBookedSelectedDay]);

  const selectedService =
    config.services.find((s) => s.id === selectedServiceId) || config.services[0];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!user.emailVerified) {
      setErrorMsg(
        'Confirme seu e-mail através do link enviado para sua caixa de entrada antes de concluir a reserva.'
      );
      return;
    }

    if (clientAlreadyBookedSelectedDay) {
      setErrorMsg(
        'Você já possui 1 horário reservado nesta data. Escolha outro dia ou gerencie seu agendamento em Meus Horários.'
      );
      return;
    }

    if (!selectedDate || !selectedTime) {
      setErrorMsg('Selecione uma data e um horário disponível na agenda.');
      return;
    }

    if (!selectedService) {
      setErrorMsg('Escolha o procedimento desejado.');
      return;
    }

    if (clientName.trim().length < 2) {
      setErrorMsg('Informe seu nome completo.');
      return;
    }

    if (clientPhone.replace(/\D/g, '').length < 10) {
      setErrorMsg('Informe um WhatsApp válido com DDD.');
      return;
    }

    setSubmitting(true);
    try {
      // Sync client profile if phone/name updated
      if (clientProfile) {
        const needsUpdate =
          clientProfile.name !== clientName.trim() ||
          clientProfile.phone !== clientPhone.trim() ||
          clientProfile.email !== clientEmail.trim();
        if (needsUpdate) {
          await updateOwnClientProfile(user.uid, {
            name: clientName.trim(),
            phone: clientPhone.trim(),
            email: clientEmail.trim() || user.email || '',
            notes: clientProfile.notes || '',
          }).catch(() => {});
        }
      }

      const created = await createAppointmentAtomic({
        clientId: user.uid,
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        clientEmail: clientEmail.trim() || user.email || '',
        date: selectedDate,
        time: selectedTime,
        service: selectedService,
        bookingFee: config.bookingFee,
        paymentMethod,
        notes: notes.trim(),
        createdBy: 'client',
      });

      setConfirmedApt(created);
      setSelectedTime('');
      setNotes('');
    } catch (err: unknown) {
      if (err instanceof Error && err.message === 'SLOT_TAKEN') {
        setErrorMsg(
          'Este horário acabou de ser reservado por outra cliente. Escolha outro horário livre.'
        );
      } else if (err instanceof Error && err.message === 'DAY_LOCKED') {
        setErrorMsg(
          'Você já possui uma reserva confirmada para este dia. Só é permitido 1 horário por dia.'
        );
      } else {
        setErrorMsg(
          'Não foi possível confirmar o agendamento agora. Verifique sua conexão e tente novamente.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const buildConfirmationMessage = (apt: Appointment) => {
    const lines = [
      `Olá! Acabei de agendar meu horário no estúdio ${config.studioName}:`,
      ``,
      `Cliente: ${apt.clientName}`,
      `Procedimento: ${apt.serviceName}`,
      `Data: ${formatDateBR(apt.date)} às ${apt.time}`,
      `Valor do procedimento: ${formatBRL(apt.servicePrice)}`,
      `Forma de pagamento: ${PAYMENT_METHOD_LABELS[apt.paymentMethod]}`,
    ];
    if (apt.bookingFee > 0) {
      lines.push(`Taxa de reserva (Pix): ${formatBRL(apt.bookingFee)}`);
    }
    if (apt.notes) {
      lines.push(`Observações: ${apt.notes}`);
    }
    lines.push(``, `Aguardo confirmação!`);
    return lines.join('\n');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Monthly Interactive Calendar + Time Slots */}
        <div className="lg:col-span-7 space-y-6">
          {/* Calendar Card */}
          <section className="bg-white border border-[#E4E2E8] rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
                  Escolha a data
                </h2>
                <p className="text-xs text-[#5E5B66] mt-0.5">
                  Disponibilidade atualizada em tempo real
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  aria-label="Mês anterior"
                  className="p-2 rounded-lg border border-[#E4E2E8] hover:bg-[#FAFAFA] text-[#16141C] transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-[#16141C] min-w-[148px] text-center whitespace-nowrap">
                  {formatMonthYearBR(viewYear, viewMonth)}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  aria-label="Próximo mês"
                  className="p-2 rounded-lg border border-[#E4E2E8] hover:bg-[#FAFAFA] text-[#16141C] transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday Header */}
            <div className="grid grid-cols-7 gap-1.5 mb-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-[#5E5B66] py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell) => {
                const summary = getDaySummary(cell.dateStr);
                const isSelected = cell.dateStr === selectedDate;
                const isToday = cell.dateStr === todayStr;

                let statusColor = 'text-[#5E5B66]';
                if (summary.state === 'open') statusColor = 'text-emerald-700';
                if (summary.state === 'reserved') statusColor = 'text-[#7A2E4D] font-semibold';
                if (summary.state === 'full') statusColor = 'text-amber-700';
                if (summary.state === 'closed') statusColor = 'text-red-700';

                return (
                  <button
                    key={cell.dateStr}
                    type="button"
                    onClick={() => {
                      setSelectedDate(cell.dateStr);
                      setErrorMsg('');
                    }}
                    className={`min-h-[68px] sm:min-h-[76px] p-1.5 sm:p-2 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      !cell.inCurrentMonth ? 'opacity-40' : ''
                    } ${
                      isSelected
                        ? 'border-[#7A2E4D] bg-[#F7EFF2] ring-1 ring-[#7A2E4D]'
                        : summary.state === 'past'
                        ? 'border-[#E4E2E8]/70 bg-[#FAFAFA] hover:border-[#E4E2E8]'
                        : 'border-[#E4E2E8] bg-white hover:border-[#7A2E4D]/50'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`tabular-mono text-xs sm:text-sm font-semibold ${
                          isSelected
                            ? 'text-[#7A2E4D]'
                            : isToday
                            ? 'text-[#7A2E4D] underline underline-offset-2'
                            : 'text-[#16141C]'
                        }`}
                      >
                        {String(cell.dayNumber).padStart(2, '0')}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] sm:text-[11px] leading-tight truncate w-full ${statusColor}`}
                    >
                      {summary.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Clean Typographic Legend */}
            <div className="mt-4 pt-4 border-t border-[#E4E2E8] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#5E5B66]">
              <span className="text-emerald-700 font-medium">Vagas livres</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#7A2E4D] font-medium">Reservado por você</span>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700 font-medium">Lotado</span>
              <span aria-hidden="true">·</span>
              <span className="text-red-700 font-medium">Fechada</span>
              <span aria-hidden="true">·</span>
              <span>Encerrado</span>
            </div>
          </section>

          {/* Time Slots Card */}
          <section className="bg-white border border-[#E4E2E8] rounded-2xl p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
              <div>
                <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                  Horários em {formatDateBR(selectedDate)}
                </h3>
                <p className="text-xs text-[#5E5B66] capitalize mt-0.5">
                  {formatDateLongBR(selectedDate)}
                </p>
              </div>
              <span className="text-xs font-medium text-[#5E5B66]">
                {selectedDaySummary.label}
              </span>
            </div>

            {clientAlreadyBookedSelectedDay && (
              <div className="mb-4 rounded-xl border border-[#7A2E4D]/25 bg-[#F7EFF2] p-4 flex items-start gap-3">
                <Info className="w-4 h-4 text-[#7A2E4D] shrink-0 mt-0.5" />
                <div className="text-xs text-[#16141C] leading-relaxed">
                  <p className="font-semibold text-[#7A2E4D]">
                    Você já possui um horário reservado neste dia.
                  </p>
                  <p className="text-[#5E5B66] mt-0.5">
                    Para garantir atendimento exclusivo, cada cliente pode
                    reservar até 1 horário por data. Caso deseje trocar, cancele
                    o horário atual em Meus Horários ou escolha outra data.
                  </p>
                </div>
              </div>
            )}

            {selectedDayClosure && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50/70 p-4 text-xs text-red-900">
                <p className="font-semibold">Agenda fechada nesta data</p>
                <p className="mt-0.5 text-red-800">
                  Motivo: {selectedDayClosure.reason}
                </p>
              </div>
            )}

            {config.workingHours.length === 0 ? (
              <p className="text-sm text-[#5E5B66] py-6 text-center">
                Nenhum horário configurado no estúdio no momento.
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {slotStatuses.map((slot) => {
                  const disabled =
                    slot.status !== 'available' ||
                    clientAlreadyBookedSelectedDay;
                  const isPicked = selectedTime === slot.time;

                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedTime(slot.time);
                        setErrorMsg('');
                      }}
                      className={`py-3 px-3 rounded-xl border text-center transition-all ${
                        isPicked
                          ? 'bg-[#7A2E4D] border-[#7A2E4D] text-white cursor-pointer'
                          : slot.status === 'mine'
                          ? 'bg-[#F7EFF2] border-[#7A2E4D]/40 text-[#7A2E4D] cursor-not-allowed'
                          : disabled
                          ? 'bg-[#FAFAFA] border-[#E4E2E8] text-[#5E5B66]/65 cursor-not-allowed'
                          : 'bg-white border-[#E4E2E8] text-[#16141C] hover:border-[#7A2E4D] cursor-pointer'
                      }`}
                    >
                      <div className="tabular-mono text-base font-semibold">
                        {slot.time}
                      </div>
                      <div
                        className={`text-[11px] mt-0.5 ${
                          isPicked ? 'text-white/85' : 'text-[#5E5B66]'
                        }`}
                      >
                        {slot.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Booking Form */}
        <div className="lg:col-span-5">
          <form
            onSubmit={handleConfirmBooking}
            className="bg-white border border-[#E4E2E8] rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div className="pb-4 border-b border-[#E4E2E8]">
              <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
                Dados do Agendamento
              </h2>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-[#5E5B66]">
                <CalendarDays className="w-3.5 h-3.5 text-[#7A2E4D]" />
                <span className="tabular-mono font-medium text-[#16141C]">
                  {formatDateBR(selectedDate)}
                </span>
                <span aria-hidden="true">·</span>
                <Clock className="w-3.5 h-3.5 text-[#7A2E4D]" />
                <span className="tabular-mono font-medium text-[#16141C]">
                  {selectedTime || 'Selecione um horário'}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-red-200 bg-red-50/80 p-3.5 flex items-start gap-2.5 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Procedure Selection */}
            <div>
              <label className="block text-xs font-semibold text-[#16141C] mb-2">
                Procedimento
              </label>
              <div className="space-y-2">
                {config.services.map((srv) => {
                  const active = srv.id === selectedService?.id;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => setSelectedServiceId(srv.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                        active
                          ? 'border-[#7A2E4D] bg-[#F7EFF2]'
                          : 'border-[#E4E2E8] bg-[#FAFAFA] hover:bg-white'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#16141C] truncate">
                          {srv.name}
                        </p>
                        <p className="text-xs text-[#5E5B66] mt-0.5 tabular-mono">
                          {srv.durationMinutes} min
                        </p>
                      </div>
                      <span className="tabular-mono text-sm font-semibold text-[#7A2E4D] shrink-0">
                        {formatBRL(srv.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs font-semibold text-[#16141C] mb-2">
                Forma de pagamento no atendimento
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  ['pix', 'credit', 'debit', 'cash'] as PaymentMethod[]
                ).map((method) => {
                  const active = paymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'border-[#7A2E4D] bg-[#7A2E4D] text-white'
                          : 'border-[#E4E2E8] bg-white text-[#16141C] hover:border-[#7A2E4D]/50'
                      }`}
                    >
                      {PAYMENT_METHOD_LABELS[method]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Client Details */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Nome completo
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  maxLength={120}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#16141C] mb-1">
                    WhatsApp com DDD
                  </label>
                  <input
                    type="tel"
                    value={clientPhone}
                    onChange={(e) =>
                      setClientPhone(formatPhoneMask(e.target.value))
                    }
                    placeholder="(11) 99999-9999"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm text-[#16141C]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#16141C] mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    maxLength={160}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C]"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#16141C] mb-1">
                  Observações (opcional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="Ex: preferência de formato, remoção anterior, alergias..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm text-[#16141C] resize-none"
                />
              </div>
            </div>

            {/* Location Preview + Policies */}
            <div className="rounded-xl bg-[#FAFAFA] border border-[#E4E2E8] p-4 space-y-2.5 text-xs text-[#5E5B66]">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#7A2E4D] shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-[#16141C]">
                    Local do atendimento
                  </p>
                  <p className="mt-0.5">{config.address}</p>
                  {config.referencePoint && (
                    <p className="text-[11px] mt-0.5">
                      Ref.: {config.referencePoint}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2.5 border-t border-[#E4E2E8] space-y-1">
                <p className="font-medium text-[#16141C]">
                  Política de reserva e cancelamento
                </p>
                {config.bookingFee > 0 ? (
                  <p>
                    Taxa de reserva (sinal via Pix):{' '}
                    <span className="tabular-mono font-semibold text-[#16141C]">
                      {formatBRL(config.bookingFee)}
                    </span>{' '}
                    (abatida no atendimento).
                  </p>
                ) : (
                  <p>Sem taxa de reserva antecipada para este agendamento.</p>
                )}
                <p>
                  Cancelamento gratuito com mais de{' '}
                  <strong className="text-[#16141C]">2 horas</strong> de
                  antecedência. Cancelamentos com menos de 2h estão sujeitos à
                  taxa de{' '}
                  <span className="tabular-mono font-semibold text-[#16141C]">
                    {formatBRL(config.cancellationFee)}
                  </span>
                  .
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={
                submitting ||
                !selectedTime ||
                clientAlreadyBookedSelectedDay ||
                !selectedService
              }
              className="w-full py-3 px-5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              {submitting ? 'Confirmando horário...' : 'Confirmar Agendamento'}
            </button>
          </form>
        </div>
      </div>

      {/* Booking Confirmation Modal ("Horário confirmado!") */}
      {confirmedApt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/55 backdrop-blur-[2px] p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative w-full max-w-2xl bg-[#FAFAFA] border border-[#E4E2E8] rounded-2xl p-6 sm:p-8 my-8 shadow-xl">
            <button
              type="button"
              onClick={() => setConfirmedApt(null)}
              aria-label="Fechar"
              className="absolute right-4 top-4 p-2 rounded-lg text-[#5E5B66] hover:text-[#16141C] hover:bg-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif text-3xl font-semibold text-[#16141C] leading-none">
                  Horário confirmado!
                </h3>
                <p className="text-sm text-[#5E5B66] mt-1">
                  Sua reserva no estúdio {config.studioName} foi registrada com
                  sucesso.
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-white border border-[#E4E2E8] p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-5">
              <div>
                <span className="text-[#5E5B66]">Data e horário</span>
                <p className="tabular-mono text-sm font-semibold text-[#16141C] mt-0.5">
                  {formatDateBR(confirmedApt.date)} às {confirmedApt.time}
                </p>
              </div>
              <div>
                <span className="text-[#5E5B66]">Procedimento</span>
                <p className="text-sm font-semibold text-[#16141C] mt-0.5">
                  {confirmedApt.serviceName}
                </p>
              </div>
              <div>
                <span className="text-[#5E5B66]">Valor e pagamento</span>
                <p className="text-sm font-semibold text-[#16141C] mt-0.5">
                  <span className="tabular-mono">
                    {formatBRL(confirmedApt.servicePrice)}
                  </span>{' '}
                  · {PAYMENT_METHOD_LABELS[confirmedApt.paymentMethod]}
                </p>
              </div>
              <div>
                <span className="text-[#5E5B66]">Endereço</span>
                <p className="text-sm font-medium text-[#16141C] mt-0.5">
                  {config.address}
                </p>
              </div>
            </div>

            {/* Pix QR Code + Copia e Cola for Booking Fee (> R$ 0) */}
            {confirmedApt.bookingFee > 0 && (
              <div className="mb-5">
                <PixPaymentCard
                  pixKey={config.pixKey}
                  pixHolder={config.pixHolder}
                  pixCity={config.pixCity}
                  amount={confirmedApt.bookingFee}
                  txid={`RES${confirmedApt.date.replace(/-/g, '')}`}
                  title="Taxa de Reserva (Sinal via Pix)"
                  subtitle="Realize o pagamento do sinal para garantir sua vaga."
                  mode="client"
                  whatsappPhone={config.whatsapp}
                  whatsappContextText={`Olá! Segue o comprovante da taxa de reserva (${formatBRL(
                    confirmedApt.bookingFee
                  )}) do meu agendamento em ${formatDateBR(
                    confirmedApt.date
                  )} às ${confirmedApt.time} — ${confirmedApt.serviceName}.`}
                  compact
                />
              </div>
            )}

            {/* Highlighted WhatsApp Confirmation CTA + Secondary Actions */}
            <div className="space-y-2.5">
              <a
                href={buildWhatsAppUrl(
                  config.whatsapp,
                  buildConfirmationMessage(confirmedApt)
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar confirmação por WhatsApp
              </a>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {config.email && (
                  <a
                    href={`mailto:${config.email}?subject=${encodeURIComponent(
                      `Confirmação de agendamento - ${config.studioName}`
                    )}&body=${encodeURIComponent(
                      buildConfirmationMessage(confirmedApt)
                    )}`}
                    className="py-2.5 px-4 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] transition-colors flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4 text-[#5E5B66]" />
                    Enviar por E-mail
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmedApt(null);
                    onGoToAppointments();
                  }}
                  className="py-2.5 px-4 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] transition-colors cursor-pointer"
                >
                  Ir para Meus Horários
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
