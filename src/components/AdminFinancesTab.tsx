import React, { useMemo, useState } from 'react';
import { PlusCircle, QrCode, Trash2 } from 'lucide-react';
import {
  createFinanceEntry,
  deleteFinanceEntry,
} from '../lib/firestoreService';
import { formatBRL, formatDateBR, getTodayDateStr } from '../lib/formatters';
import {
  FINANCE_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type FinanceEntry,
  type FinanceType,
  type PaymentMethod,
  type StudioConfig,
} from '../types';
import { PixPaymentModal } from './PixPaymentModal';

interface AdminFinancesTabProps {
  finances: FinanceEntry[];
  config: StudioConfig;
}

export const AdminFinancesTab: React.FC<AdminFinancesTabProps> = ({
  finances,
  config,
}) => {
  const today = getTodayDateStr();
  const currentMonthPrefix = today.slice(0, 7); // YYYY-MM

  const [type, setType] = useState<FinanceType>('service');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Instant Pix Charge Modal
  const [pixChargeOpen, setPixChargeOpen] = useState(false);
  const [pixChargeAmount, setPixChargeAmount] = useState(0);
  const [pixChargeTitle, setPixChargeTitle] = useState('Cobrança via Pix');

  const stats = useMemo(() => {
    let dayTotal = 0;
    let monthTotal = 0;
    let overallTotal = 0;
    const byMethod: Record<PaymentMethod, number> = {
      pix: 0,
      credit: 0,
      debit: 0,
      cash: 0,
    };

    finances.forEach((entry) => {
      const amt = Number(entry.amount) || 0;
      overallTotal += amt;
      if (entry.date === today) dayTotal += amt;
      if (entry.date?.startsWith(currentMonthPrefix)) monthTotal += amt;
      if (entry.paymentMethod in byMethod) {
        byMethod[entry.paymentMethod] += amt;
      }
    });

    return { dayTotal, monthTotal, overallTotal, byMethod };
  }, [finances, today, currentMonthPrefix]);

  const sortedEntries = useMemo(() => {
    return [...finances].sort((a, b) => b.date.localeCompare(a.date));
  }, [finances]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const parsedAmount = parseFloat(amountStr.replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMsg('Informe um valor maior que R$ 0,00.');
      return;
    }
    if (description.trim().length < 2) {
      setErrorMsg('Informe uma descrição para o lançamento.');
      return;
    }

    setSaving(true);
    try {
      await createFinanceEntry({
        type,
        description: description.trim(),
        clientName: clientName.trim() || 'Cliente avulsa',
        amount: parsedAmount,
        paymentMethod,
        date,
      });
      setDescription('');
      setClientName('');
      setAmountStr('');
    } catch {
      setErrorMsg('Não foi possível registrar o lançamento financeiro.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenInstantPix = () => {
    const parsed = parseFloat(amountStr.replace(',', '.'));
    const validAmt = Number.isFinite(parsed) && parsed > 0 ? parsed : config.services[0]?.price || 100;
    setPixChargeAmount(validAmt);
    setPixChargeTitle(description.trim() || 'Cobrança Pix na Hora');
    setPixChargeOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteFinanceEntry(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E4E2E8] rounded-2xl p-5">
          <p className="text-xs text-[#5E5B66]">Entradas de hoje</p>
          <p className="tabular-mono text-2xl font-semibold text-[#16141C] mt-1.5">
            {formatBRL(stats.dayTotal)}
          </p>
        </div>
        <div className="bg-white border border-[#E4E2E8] rounded-2xl p-5">
          <p className="text-xs text-[#5E5B66]">Entradas do mês</p>
          <p className="tabular-mono text-2xl font-semibold text-[#7A2E4D] mt-1.5">
            {formatBRL(stats.monthTotal)}
          </p>
        </div>
        <div className="bg-white border border-[#E4E2E8] rounded-2xl p-5">
          <p className="text-xs text-[#5E5B66]">Total acumulado</p>
          <p className="tabular-mono text-2xl font-semibold text-[#16141C] mt-1.5">
            {formatBRL(stats.overallTotal)}
          </p>
        </div>
      </div>

      {/* Distribution by Payment Method */}
      <div className="bg-white border border-[#E4E2E8] rounded-2xl p-5">
        <h3 className="text-xs font-semibold text-[#5E5B66] mb-3">
          Distribuição por forma de pagamento
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {(['pix', 'credit', 'debit', 'cash'] as PaymentMethod[]).map((m) => (
            <div
              key={m}
              className="rounded-xl bg-[#FAFAFA] border border-[#E4E2E8] p-3.5"
            >
              <p className="text-xs text-[#5E5B66]">
                {PAYMENT_METHOD_LABELS[m]}
              </p>
              <p className="tabular-mono text-base font-semibold text-[#16141C] mt-1">
                {formatBRL(stats.byMethod[m])}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Manual Entry + Instant Pix Generator */}
        <form
          onSubmit={handleAddEntry}
          className="lg:col-span-5 bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4"
        >
          <div>
            <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
              Registrar Entrada
            </h2>
            <p className="text-xs text-[#5E5B66] mt-0.5">
              Lance atendimentos manuais, taxas ou gere um QR Code Pix na hora.
            </p>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Tipo de entrada
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FinanceType)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
            >
              <option value="service">Atendimento</option>
              <option value="cancellation_fee">Taxa de Cancelamento</option>
              <option value="booking_fee">Taxa de Reserva (Sinal)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Descrição
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Banho de Gel Natural"
              maxLength={200}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Cliente
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nome da cliente"
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Valor (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="120,00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#16141C] mb-1">
                Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Forma de pagamento
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] text-sm"
            >
              {(['pix', 'credit', 'debit', 'cash'] as PaymentMethod[]).map(
                (m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                )
              )}
            </select>
          </div>

          <div className="flex flex-col gap-2.5 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              {saving ? 'Registrando...' : 'Registrar no Financeiro'}
            </button>
            <button
              type="button"
              onClick={handleOpenInstantPix}
              className="w-full py-2.5 px-4 rounded-xl border border-[#7A2E4D]/35 bg-[#F7EFF2] hover:bg-[#EFE0E6] text-[#7A2E4D] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              Gerar QR Code Pix para cobrar agora
            </button>
          </div>
        </form>

        {/* Entries Table */}
        <div className="lg:col-span-7 bg-white border border-[#E4E2E8] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-[#E4E2E8] flex items-baseline justify-between">
            <h2 className="font-serif text-2xl font-semibold text-[#16141C]">
              Lançamentos Financeiros
            </h2>
            <span className="tabular-mono text-xs text-[#5E5B66]">
              {sortedEntries.length} lançamento{sortedEntries.length === 1 ? '' : 's'}
            </span>
          </div>

          {sortedEntries.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#5E5B66]">
              Nenhum lançamento financeiro registrado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E4E2E8] bg-[#FAFAFA] text-xs font-semibold text-[#5E5B66]">
                    <th className="py-3 px-4">Data</th>
                    <th className="py-3 px-4">Descrição / Cliente</th>
                    <th className="py-3 px-4">Pagamento</th>
                    <th className="py-3 px-4 text-right">Valor</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4E2E8] text-xs">
                  {sortedEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-[#FAFAFA]/80 transition-colors"
                    >
                      <td className="py-3.5 px-4 tabular-mono text-[#5E5B66] whitespace-nowrap">
                        {formatDateBR(entry.date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-[#16141C] text-sm">
                          {entry.description}
                        </p>
                        <p className="text-[#5E5B66]">
                          {FINANCE_TYPE_LABELS[entry.type]} · {entry.clientName}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-[#5E5B66] whitespace-nowrap">
                        {PAYMENT_METHOD_LABELS[entry.paymentMethod]}
                      </td>
                      <td className="py-3.5 px-4 text-right tabular-mono font-semibold text-emerald-700 whitespace-nowrap">
                        {formatBRL(entry.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={deletingId === entry.id}
                          onClick={() => handleDelete(entry.id)}
                          aria-label="Excluir lançamento"
                          className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Instant Pix Charge Modal */}
      <PixPaymentModal
        open={pixChargeOpen}
        onClose={() => setPixChargeOpen(false)}
        config={config}
        amount={pixChargeAmount}
        title={pixChargeTitle}
        subtitle="QR Code Pix gerado na hora para cobrança presencial ou envio"
        txid={`COB${today.replace(/-/g, '')}`}
        mode="admin"
        whatsappPhone={config.whatsapp}
      />
    </div>
  );
};
