import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  MapPin,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { saveStudioConfig } from '../lib/firestoreService';
import {
  buildMapsUrlFromAddress,
  formatBRL,
  formatPhoneMask,
  generateSafeId,
} from '../lib/formatters';
import type { ServiceItem, StudioConfig } from '../types';
import { PixPaymentCard } from './PixPaymentCard';

interface AdminStudioPixTabProps {
  config: StudioConfig;
}

export const AdminStudioPixTab: React.FC<AdminStudioPixTabProps> = ({
  config,
}) => {
  const [form, setForm] = useState<StudioConfig>(config);
  const [newHour, setNewHour] = useState('');
  const [previewAmount, setPreviewAmount] = useState<number>(
    config.bookingFee || config.cancellationFee || 30
  );
  const [previewLabel, setPreviewLabel] = useState('Pré-visualização Pix');

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setForm(config);
  }, [config]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice('');
    setErrorMsg('');

    try {
      await saveStudioConfig(form);
      setSavedNotice('Configurações do estúdio e Pix salvas em tempo real!');
      setTimeout(() => setSavedNotice(''), 4000);
    } catch {
      setErrorMsg('Não foi possível salvar as configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddWorkingHour = () => {
    const clean = newHour.trim();
    if (!/^[0-9]{2}:[0-9]{2}$/.test(clean)) return;
    if (form.workingHours.includes(clean)) {
      setNewHour('');
      return;
    }
    setForm((prev) => ({
      ...prev,
      workingHours: [...prev.workingHours, clean].sort(),
    }));
    setNewHour('');
  };

  const handleRemoveWorkingHour = (hour: string) => {
    setForm((prev) => ({
      ...prev,
      workingHours: prev.workingHours.filter((h) => h !== hour),
    }));
  };

  const handleAddService = () => {
    const item: ServiceItem = {
      id: generateSafeId('srv'),
      name: 'Novo Procedimento',
      durationMinutes: 60,
      price: 90,
    };
    setForm((prev) => ({
      ...prev,
      services: [...prev.services, item],
    }));
  };

  const handleUpdateService = (
    id: string,
    field: keyof ServiceItem,
    value: string | number
  ) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const handleRemoveService = (id: string) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.filter((s) => s.id !== id),
    }));
  };

  const handleGenerateMapsLink = () => {
    const generated = buildMapsUrlFromAddress(form.address);
    if (generated) {
      setForm((prev) => ({ ...prev, googleMapsUrl: generated }));
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Top Save Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-3xl font-semibold text-[#16141C]">
            Configurações do Salão &amp; Pix
          </h2>
          <p className="text-sm text-[#5E5B66] mt-0.5">
            Alterações refletem instantaneamente na área das clientes.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] disabled:opacity-60 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {savedNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-xs text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>{savedNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
          {errorMsg}
        </div>
      )}

      {/* Section 1: Identity & Fees */}
      <section className="bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4">
        <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
          Estúdio e Taxas
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Nome do salão / estúdio
            </label>
            <input
              type="text"
              value={form.studioName}
              onChange={(e) =>
                setForm((p) => ({ ...p, studioName: e.target.value }))
              }
              maxLength={100}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Taxa de reserva / sinal (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.bookingFee}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  bookingFee: Math.max(0, parseFloat(e.target.value) || 0),
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Taxa cancelamento &lt; 2h (R$)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cancellationFee}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  cancellationFee: Math.max(0, parseFloat(e.target.value) || 0),
                }))
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Pix Configuration + Live QR Preview */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5 bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
              Dados do Pix (EMV BR Code)
            </h3>
            <p className="text-xs text-[#5E5B66] mt-0.5">
              Aceita CPF, CNPJ, celular com DDD, e-mail ou chave aleatória.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Chave Pix
            </label>
            <input
              type="text"
              value={form.pixKey}
              onChange={(e) =>
                setForm((p) => ({ ...p, pixKey: e.target.value }))
              }
              placeholder="CPF, celular, e-mail ou chave aleatória"
              maxLength={140}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Nome do titular do Pix
            </label>
            <input
              type="text"
              value={form.pixHolder}
              onChange={(e) =>
                setForm((p) => ({ ...p, pixHolder: e.target.value }))
              }
              placeholder="Ex: JU NAIL DESIGNER"
              maxLength={80}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Cidade do titular
            </label>
            <input
              type="text"
              value={form.pixCity}
              onChange={(e) =>
                setForm((p) => ({ ...p, pixCity: e.target.value }))
              }
              placeholder="Ex: SAO PAULO"
              maxLength={40}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          {/* Quick Preview Value Shortcuts */}
          <div className="pt-3 border-t border-[#E4E2E8] space-y-2">
            <p className="text-xs font-medium text-[#5E5B66]">
              Testar valor na pré-visualização ao vivo:
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewAmount(form.bookingFee);
                  setPreviewLabel('Teste — Taxa de Reserva');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E4E2E8] bg-[#FAFAFA] hover:bg-white text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Taxa de Reserva ({formatBRL(form.bookingFee)})
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewAmount(form.cancellationFee);
                  setPreviewLabel('Teste — Taxa de Cancelamento');
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E4E2E8] bg-[#FAFAFA] hover:bg-white text-xs font-medium text-[#16141C] cursor-pointer"
              >
                Taxa Cancelamento ({formatBRL(form.cancellationFee)})
              </button>
            </div>
          </div>
        </div>

        {/* Live QR Code Preview */}
        <div className="lg:col-span-7">
          <PixPaymentCard
            pixKey={form.pixKey}
            pixHolder={form.pixHolder}
            pixCity={form.pixCity}
            amount={previewAmount}
            txid="JUNAILDESIGNERTESTE"
            title={previewLabel}
            subtitle="Pré-visualização ao vivo do QR Code oficial lido por todos os bancos"
            mode="preview"
          />
        </div>
      </section>

      {/* Section 3: Location & Contacts */}
      <section className="bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4">
        <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
          Localização e Contatos
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Endereço completo
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) =>
                setForm((p) => ({ ...p, address: e.target.value }))
              }
              maxLength={250}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Ponto de referência
            </label>
            <input
              type="text"
              value={form.referencePoint}
              onChange={(e) =>
                setForm((p) => ({ ...p, referencePoint: e.target.value }))
              }
              maxLength={200}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="block text-xs font-medium text-[#16141C]">
                Link do Google Maps
              </label>
              <button
                type="button"
                onClick={handleGenerateMapsLink}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#7A2E4D] hover:text-[#61233C] cursor-pointer"
              >
                <MapPin className="w-3.5 h-3.5" />
                Gerar link automático pelo endereço
              </button>
            </div>
            <input
              type="url"
              value={form.googleMapsUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, googleMapsUrl: e.target.value }))
              }
              maxLength={500}
              placeholder="https://www.google.com/maps/..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              WhatsApp do salão
            </label>
            <input
              type="tel"
              value={form.whatsapp}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  whatsapp: formatPhoneMask(e.target.value),
                }))
              }
              placeholder="(11) 99999-9999"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white tabular-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              E-mail de contato
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((p) => ({ ...p, email: e.target.value }))
              }
              maxLength={160}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-[#16141C] mb-1">
              Instagram do salão (@usuario ou link completo)
            </label>
            <input
              type="text"
              value={form.instagram}
              onChange={(e) =>
                setForm((p) => ({ ...p, instagram: e.target.value }))
              }
              placeholder="@junaildesigner"
              maxLength={160}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] focus:bg-white text-sm"
            />
          </div>
        </div>
      </section>

      {/* Section 4: Working Hours & Services Catalog */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Working Hours */}
        <section className="lg:col-span-5 bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
              Horários de Atendimento
            </h3>
            <p className="text-xs text-[#5E5B66] mt-0.5">
              Horários exibidos diariamente na agenda online.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="time"
              value={newHour}
              onChange={(e) => setNewHour(e.target.value)}
              className="flex-1 px-3.5 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] tabular-mono text-sm"
            />
            <button
              type="button"
              onClick={handleAddWorkingHour}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {form.workingHours.map((hour) => (
              <div
                key={hour}
                className="flex items-center justify-between px-3 py-2 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA]"
              >
                <span className="tabular-mono text-sm font-medium text-[#16141C]">
                  {hour}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveWorkingHour(hour)}
                  aria-label={`Remover horário ${hour}`}
                  className="text-[#5E5B66] hover:text-red-700 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Procedures Catalog */}
        <section className="lg:col-span-7 bg-white border border-[#E4E2E8] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
                Procedimentos e Valores
              </h3>
              <p className="text-xs text-[#5E5B66] mt-0.5">
                Edite nome, duração (min) e preço em R$.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddService}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#7A2E4D]/30 bg-[#F7EFF2] hover:bg-[#EFE0E6] text-[#7A2E4D] text-xs font-semibold whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Novo Serviço
            </button>
          </div>

          <div className="space-y-3">
            {form.services.map((srv) => (
              <div
                key={srv.id}
                className="grid grid-cols-1 sm:grid-cols-[1fr_92px_110px_36px] gap-2.5 items-center p-3 rounded-xl border border-[#E4E2E8] bg-[#FAFAFA]"
              >
                <input
                  type="text"
                  value={srv.name}
                  onChange={(e) =>
                    handleUpdateService(srv.id, 'name', e.target.value)
                  }
                  placeholder="Nome do procedimento"
                  maxLength={120}
                  className="px-3 py-2 rounded-lg border border-[#E4E2E8] bg-white text-sm text-[#16141C]"
                />
                <div className="relative">
                  <input
                    type="number"
                    min="15"
                    max="480"
                    value={srv.durationMinutes}
                    onChange={(e) =>
                      handleUpdateService(
                        srv.id,
                        'durationMinutes',
                        parseInt(e.target.value, 10) || 60
                      )
                    }
                    className="w-full px-2.5 py-2 rounded-lg border border-[#E4E2E8] bg-white tabular-mono text-xs text-[#16141C]"
                    title="Duração em minutos"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#5E5B66] pointer-events-none">
                    min
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#5E5B66] pointer-events-none">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={srv.price}
                    onChange={(e) =>
                      handleUpdateService(
                        srv.id,
                        'price',
                        parseFloat(e.target.value) || 0
                      )
                    }
                    className="w-full pl-8 pr-2.5 py-2 rounded-lg border border-[#E4E2E8] bg-white tabular-mono text-xs text-[#16141C]"
                    title="Preço em reais"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveService(srv.id)}
                  aria-label="Remover serviço"
                  className="p-2 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-700 flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </form>
  );
};
