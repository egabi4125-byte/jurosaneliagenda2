import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, QrCode, Send } from 'lucide-react';
import { generatePixBrCode, generatePixQrDataUrl } from '../lib/pix';
import { buildWhatsAppUrl, formatBRL } from '../lib/formatters';

interface PixPaymentCardProps {
  pixKey: string;
  pixHolder: string;
  pixCity: string;
  amount: number;
  txid?: string;
  title?: string;
  subtitle?: string;
  mode: 'client' | 'admin' | 'preview';
  whatsappPhone?: string;
  whatsappContextText?: string;
  compact?: boolean;
}

export const PixPaymentCard: React.FC<PixPaymentCardProps> = ({
  pixKey,
  pixHolder,
  pixCity,
  amount,
  txid = 'JUNAILDESIGNER',
  title = 'Pagamento via Pix',
  subtitle,
  mode,
  whatsappPhone,
  whatsappContextText,
  compact = false,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const brCode = useMemo(
    () =>
      generatePixBrCode({
        pixKey,
        merchantName: pixHolder,
        merchantCity: pixCity,
        amount: amount > 0 ? amount : undefined,
        txid,
      }),
    [pixKey, pixHolder, pixCity, amount, txid]
  );

  useEffect(() => {
    let active = true;
    if (!brCode.valid || !brCode.payload) {
      setQrDataUrl('');
      return;
    }
    generatePixQrDataUrl(brCode.payload)
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [brCode.payload, brCode.valid]);

  const copyText = async (text: string, target: 'key' | 'code') => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    if (target === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2200);
    } else {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2200);
    }
  };

  if (!brCode.valid) {
    return (
      <div className="rounded-xl border border-[#E4E2E8] bg-[#FAFAFA] p-5 text-center">
        <QrCode className="w-7 h-7 text-[#5E5B66] mx-auto mb-2" />
        <p className="text-sm font-medium text-[#16141C]">
          Chave Pix não configurada
        </p>
        <p className="text-xs text-[#5E5B66] mt-1">
          Informe uma chave Pix válida (CPF, CNPJ, celular, e-mail ou chave
          aleatória) em Salão &amp; Pix para gerar o QR Code.
        </p>
      </div>
    );
  }

  const clientReceiptMessage =
    whatsappContextText ||
    `Olá! Segue o comprovante do pagamento via Pix no valor de ${formatBRL(amount)} (referente a ${title}).`;

  const adminSendCodeMessage =
    whatsappContextText ||
    `Olá! Segue o código Pix Copia e Cola no valor de ${formatBRL(amount)} (${title}):\n\n${brCode.payload}\n\nChave Pix (${brCode.keyType}): ${brCode.normalizedKey}\nTitular: ${pixHolder}`;

  const whatsappHref =
    mode === 'client'
      ? buildWhatsAppUrl(whatsappPhone || '', clientReceiptMessage)
      : buildWhatsAppUrl(whatsappPhone || '', adminSendCodeMessage);

  return (
    <div
      className={`rounded-xl border border-[#E4E2E8] bg-white ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[#E4E2E8]">
        <div>
          <h4 className="font-serif text-xl font-semibold text-[#16141C]">
            {title}
          </h4>
          {subtitle && (
            <p className="text-xs text-[#5E5B66] mt-0.5">{subtitle}</p>
          )}
        </div>
        {amount > 0 && (
          <span className="tabular-mono text-xl font-semibold text-[#7A2E4D]">
            {formatBRL(amount)}
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-5 items-center">
        <div className="flex flex-col items-center justify-center">
          <div className="w-48 h-48 rounded-xl border border-[#E4E2E8] bg-white p-2 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR Code Pix"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-[#5E5B66]">Gerando QR Code...</div>
            )}
          </div>
          <p className="mt-2 text-xs text-[#5E5B66] text-center">
            Aponte a câmera no app do seu banco
          </p>
        </div>

        <div className="space-y-4 min-w-0">
          <div className="text-xs text-[#5E5B66] space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span>Titular</span>
              <span className="font-medium text-[#16141C] truncate">
                {pixHolder || 'Ju Nail Designer'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Cidade</span>
              <span className="font-medium text-[#16141C] truncate">
                {pixCity || 'SAO PAULO'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span>Tipo de chave</span>
              <span className="font-medium text-[#16141C]">{brCode.keyType}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5E5B66] mb-1">
              Chave Pix
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E4E2E8] tabular-mono text-xs text-[#16141C] truncate">
                {brCode.normalizedKey}
              </div>
              <button
                type="button"
                onClick={() => copyText(brCode.normalizedKey, 'key')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                    Copiada
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copiar chave
                  </>
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#5E5B66] mb-1">
              Pix Copia e Cola (EMV BR Code)
            </label>
            <div className="px-3 py-2 rounded-lg bg-[#FAFAFA] border border-[#E4E2E8] tabular-mono text-[11px] leading-relaxed text-[#5E5B66] break-all max-h-20 overflow-y-auto">
              {brCode.payload}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => copyText(brCode.payload, 'code')}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-4 h-4" />
                    Pix Copia e Cola copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar Pix Copia e Cola
                  </>
                )}
              </button>

              {mode !== 'preview' && whatsappPhone && (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#7A2E4D]/30 bg-[#F7EFF2] hover:bg-[#EFE0E6] text-[#7A2E4D] text-xs font-medium transition-colors whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  {mode === 'client'
                    ? 'Enviar comprovante no WhatsApp'
                    : 'Enviar Copia e Cola no WhatsApp'}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
