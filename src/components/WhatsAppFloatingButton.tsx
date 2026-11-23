import React from 'react';
import { buildWhatsAppUrl } from '../lib/formatters';

interface WhatsAppFloatingButtonProps {
  phone: string;
  studioName?: string;
}

export const WhatsAppFloatingButton: React.FC<WhatsAppFloatingButtonProps> = ({
  phone,
  studioName = 'Ju Nail Designer',
}) => {
  if (!phone) return null;

  const href = buildWhatsAppUrl(
    phone,
    `Olá! Gostaria de falar com o estúdio ${studioName}.`
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Falar no WhatsApp"
      title="Falar no WhatsApp"
      className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-[#25D366] hover:bg-[#1FB858] text-white shadow-lg flex items-center justify-center transition-transform duration-150 hover:scale-105 active:scale-95"
    >
      <svg
        viewBox="0 0 32 32"
        className="w-7 h-7 fill-current"
        aria-hidden="true"
      >
        <path d="M16.002 3.2c-7.06 0-12.8 5.74-12.8 12.8 0 2.256.588 4.46 1.704 6.404L3.2 28.8l6.588-1.728a12.74 12.74 0 0 0 6.214 1.612h.006c7.058 0 12.796-5.74 12.796-12.8 0-3.42-1.332-6.634-3.75-9.052a12.716 12.716 0 0 0-9.052-3.632zm7.46 18.084c-.312.878-1.824 1.68-2.518 1.784-.644.096-1.462.136-2.36-.148-.544-.174-1.244-.406-2.14-.794-3.766-1.626-6.224-5.414-6.412-5.664-.188-.25-1.53-2.036-1.53-3.884 0-1.848.968-2.756 1.312-3.132.344-.376.75-.47 1-.47.25 0 .5.002.718.014.23.012.54-.088.844.644.312.752 1.064 2.598 1.158 2.786.094.188.156.406.032.656-.126.25-.188.406-.376.626-.188.22-.394.49-.562.658-.188.188-.384.392-.164.768.218.376.972 1.604 2.088 2.598 1.434 1.278 2.642 1.674 3.018 1.862.376.188.594.156.812-.094.22-.25.938-1.094 1.188-1.47.25-.376.5-.312.844-.188.344.126 2.188 1.032 2.564 1.22.376.188.626.282.718.438.094.156.094.908-.218 1.786z" />
      </svg>
    </a>
  );
};
