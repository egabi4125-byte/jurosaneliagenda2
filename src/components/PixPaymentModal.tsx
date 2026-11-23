import React from 'react';
import { X } from 'lucide-react';
import { PixPaymentCard } from './PixPaymentCard';
import type { StudioConfig } from '../types';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  config: StudioConfig;
  amount: number;
  title: string;
  subtitle?: string;
  txid?: string;
  mode: 'client' | 'admin';
  whatsappPhone?: string;
  whatsappContextText?: string;
  amountOptions?: { label: string; amount: number; subtitle?: string }[];
  onSelectAmount?: (amount: number, label: string) => void;
}

export const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  open,
  onClose,
  config,
  amount,
  title,
  subtitle,
  txid,
  mode,
  whatsappPhone,
  whatsappContextText,
  amountOptions,
  onSelectAmount,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#16141C]/50 backdrop-blur-[2px] p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-[#FAFAFA] border border-[#E4E2E8] rounded-2xl p-5 sm:p-6 my-8 shadow-xl">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-sm text-[#5E5B66] mt-0.5">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="p-2 rounded-lg text-[#5E5B66] hover:text-[#16141C] hover:bg-white border border-transparent hover:border-[#E4E2E8] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {amountOptions && amountOptions.length > 0 && onSelectAmount && (
          <div className="mb-4 flex flex-wrap gap-2">
            {amountOptions.map((opt) => {
              const active = Math.abs(opt.amount - amount) < 0.01;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => onSelectAmount(opt.amount, opt.label)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#7A2E4D] text-white border-[#7A2E4D]'
                      : 'bg-white text-[#16141C] border-[#E4E2E8] hover:border-[#7A2E4D]/50'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        <PixPaymentCard
          pixKey={config.pixKey}
          pixHolder={config.pixHolder}
          pixCity={config.pixCity}
          amount={amount}
          txid={txid}
          title={title}
          subtitle={subtitle}
          mode={mode}
          whatsappPhone={whatsappPhone}
          whatsappContextText={whatsappContextText}
        />

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-sm font-medium text-[#16141C] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
