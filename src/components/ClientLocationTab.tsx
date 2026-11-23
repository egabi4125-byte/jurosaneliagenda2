import React, { useState } from 'react';
import {
  ExternalLink,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Navigation,
} from 'lucide-react';
import {
  buildMapsUrlFromAddress,
  buildWhatsAppUrl,
  normalizeInstagramUrl,
} from '../lib/formatters';
import { STUDIO_LOCATION_IMAGE, type StudioConfig } from '../types';

interface ClientLocationTabProps {
  config: StudioConfig;
}

export const ClientLocationTab: React.FC<ClientLocationTabProps> = ({
  config,
}) => {
  const [imgError, setImgError] = useState(false);

  const mapsUrl =
    config.googleMapsUrl || buildMapsUrlFromAddress(config.address);
  const instagramUrl = normalizeInstagramUrl(config.instagram);
  const whatsappUrl = buildWhatsAppUrl(
    config.whatsapp,
    `Olá! Gostaria de confirmar a localização do estúdio ${config.studioName}.`
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      {/* Studio Environment Photo */}
      <div className="lg:col-span-7 bg-white border border-[#E4E2E8] rounded-2xl overflow-hidden flex flex-col">
        <div className="relative aspect-[16/10] w-full bg-[#EFECE8] overflow-hidden">
          {!imgError ? (
            <img
              src={STUDIO_LOCATION_IMAGE}
              alt={`Ambiente do estúdio ${config.studioName}`}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#F7EFF2] to-[#ECE8EE] text-[#7A2E4D]">
              <MapPin className="w-10 h-10" />
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <h2 className="font-serif text-3xl font-semibold text-[#16141C]">
            {config.studioName}
          </h2>
          <p className="text-sm text-[#5E5B66] mt-1">{config.subtitle}</p>
          <p className="text-sm text-[#5E5B66] leading-relaxed mt-3">
            Um espaço preparado para oferecer conforto, biossegurança e
            acabamento impecável em cada atendimento.
          </p>
        </div>
      </div>

      {/* Address & Contact Details */}
      <div className="lg:col-span-5 bg-white border border-[#E4E2E8] rounded-2xl p-6 flex flex-col justify-between gap-6">
        <div className="space-y-5">
          <div>
            <h3 className="font-serif text-2xl font-semibold text-[#16141C]">
              Como chegar e contato
            </h3>
            <p className="text-xs text-[#5E5B66] mt-0.5">
              Informações atualizadas do estúdio
            </p>
          </div>

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-[#7A2E4D] shrink-0 mt-1" />
              <div>
                <p className="text-xs font-medium text-[#5E5B66]">
                  Endereço completo
                </p>
                <p className="text-[#16141C] font-medium mt-0.5">
                  {config.address || 'Endereço não informado'}
                </p>
                {config.referencePoint && (
                  <p className="text-xs text-[#5E5B66] mt-1">
                    Ponto de referência: {config.referencePoint}
                  </p>
                )}
              </div>
            </div>

            {config.whatsapp && (
              <div className="flex items-start gap-3">
                <MessageCircle className="w-4 h-4 text-[#7A2E4D] shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-medium text-[#5E5B66]">WhatsApp</p>
                  <p className="tabular-mono text-[#16141C] font-medium mt-0.5">
                    {config.whatsapp}
                  </p>
                </div>
              </div>
            )}

            {config.email && (
              <div className="flex items-start gap-3">
                <Mail className="w-4 h-4 text-[#7A2E4D] shrink-0 mt-1" />
                <div>
                  <p className="text-xs font-medium text-[#5E5B66]">E-mail</p>
                  <p className="text-[#16141C] font-medium mt-0.5 break-all">
                    {config.email}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2.5 pt-4 border-t border-[#E4E2E8]">
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-[#7A2E4D] hover:bg-[#61233C] text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Abrir no Google Maps
            </a>
          )}

          {config.whatsapp && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-[#16141C] text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4 text-[#7A2E4D]" />
              Falar no WhatsApp
            </a>
          )}

          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-[#16141C] text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Instagram className="w-4 h-4 text-[#7A2E4D]" />
              Instagram
              <ExternalLink className="w-3.5 h-3.5 text-[#5E5B66]" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
