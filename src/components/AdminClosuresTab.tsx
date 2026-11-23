import React, { useMemo, useState } from 'react';
import { CalendarOff, Lock, Unlock } from 'lucide-react';
import { createClosure, deleteClosure } from '../lib/firestoreService';
import { addDays, formatDateBR, getTodayDateStr } from '../lib/formatters';
import type { Closure, ClosureType, StudioConfig } from '../types';

interface AdminClosuresTabProps {
  closures: Closure[];
  config: StudioConfig;
}

export const AdminClosuresTab: React.FC<AdminClosuresTabProps> = ({
  closures,
  config,
}) => {
  const [type, setType] = useState<ClosureType>('day');
  const [date, setDate] = useState(getTodayDateStr());
  const [time, setTime] = useState(config.workingHours[0] || '09:00');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sortedClosures = useMemo(() => {
    return [...closures].sort((a, b) =>
      `${a.startDate}_${a.time}`.localeCompare(`${b.startDate}_${b.time}`)
    );
  }, [closures]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!date) {
      setErrorMsg('Selecione a data do bloqueio.');
      return;
    }
    if (reason.trim().length < 2) {
      setErrorMsg('Informe o motivo do bloqueio.');
      return;
    }

    const endDate = type === 'week' ? addDays(date, 6) : date;

    setSaving(true);
    try {
      await createClosure({
        type,
        startDate: date,
        endDate,
        time: type === 'slot' ? time : '',
        reason: reason.trim(),
      });
      setReason('');
    } catch {
      setErrorMsg('Não foi possível criar o bloqueio.');
    } finally {
      setSaving(false);
    }
  };

  const handleUnblock = async (id: string) => {
    setRemovingId(id);
    try {
      await deleteClosure(id);
    } finally {
      setRemovingId(null);
    }
  };

  const closureTypeLabel = (c: Closure) => {
    if (c.type === 'day') return 'Dia inteiro';
    if (c.type === 'week') return 'Semana inteira (7 dias)';
    return `Horário pontual (${c.time})`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Create Closure Form */}
      <form
        onSubmit={handleCreate}
        className="lg:col-span-5 bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4"
      >
        <div>
          <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
            Criar Bloqueio de Agenda
          </h2>
          <p className="text-xs text-[#5E5B66] mt-0.5">
            Bloqueia imediatamente novas reservas no calendário das clientes.
          </p>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMsg}
          </p>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#16141C] mb-2">
            Tipo de bloqueio
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'day', label: 'Um dia' },
                { id: 'week', label: 'Semana (7d)' },
                { id: 'slot', label: 'Horário' },
              ] as { id: ClosureType; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  type === opt.id
                    ? 'bg-[#7A2E4D] border-[#7A2E4D] text-white'
                    : 'bg-[#FAFAFA] border-[#E4E2E8] text-[#16141C]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[#16141C] mb-1">
            {type === 'week' ? 'Data inicial da semana' : 'Data'}
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
            required
          />
          {type === 'week' && date && (
            <p className="text-[11px] text-[#5E5B66] mt-1 tabular-mono">
              Período fechado: {formatDateBR(date)} até{' '}
              {formatDateBR(addDays(date, 6))}
            </p>
          )}
        </div>

        {type === 'slot' && (
          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Horário específico
            </label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
            >
              {config.workingHours.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-[#16141C] mb-1">
            Motivo do bloqueio
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Feriado, curso de atualização, compromisso pessoal..."
            maxLength={200}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            required
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <Lock className="w-4 h-4" />
          {saving ? 'Bloqueando...' : 'Bloquear na Agenda'}
        </button>
      </form>

      {/* Active Closures List */}
      <div className="lg:col-span-7 bg-white border border-[#E4E2E8] rounded-2xl p-6">
        <div className="flex items-baseline justify-between gap-2 pb-4 border-b border-[#E4E2E8]">
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
              Bloqueios Ativos
            </h2>
            <p className="text-xs text-[#5E5B66] mt-0.5">
              Datas e horários fechados no calendário online
            </p>
          </div>
          <span className="tabular-mono text-xs text-[#5E5B66]">
            {sortedClosures.length} ativo{sortedClosures.length === 1 ? '' : 's'}
          </span>
        </div>

        {sortedClosures.length === 0 ? (
          <div className="py-12 text-center">
            <CalendarOff className="w-7 h-7 text-[#5E5B66] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#16141C]">
              Nenhum bloqueio ativo
            </p>
            <p className="text-xs text-[#5E5B66] mt-1">
              Todos os dias e horários configurados estão abertos para
              agendamento.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E4E2E8] mt-2">
            {sortedClosures.map((closure) => (
              <div
                key={closure.id}
                className="py-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-red-700">
                      {closureTypeLabel(closure)}
                    </span>
                    <span className="text-[#E4E2E8]">|</span>
                    <span className="tabular-mono font-medium text-[#16141C]">
                      {closure.type === 'week'
                        ? `${formatDateBR(closure.startDate)} a ${formatDateBR(
                            closure.endDate
                          )}`
                        : formatDateBR(closure.startDate)}
                    </span>
                  </div>
                  <p className="text-sm text-[#16141C]">{closure.reason}</p>
                </div>

                <button
                  type="button"
                  disabled={removingId === closure.id}
                  onClick={() => handleUnblock(closure.id)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] whitespace-nowrap cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5 text-[#7A2E4D]" />
                  Desbloquear
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
