import React, { useState } from 'react';

interface BrandLogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-8 h-8',
  sm: 'w-9 h-9',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      className={`${SIZE_MAP[size]} rounded-full overflow-hidden shrink-0 flex items-center justify-center bg-[#FAFAFA] ring-1 ring-[#7A2E4D]/25 ${className}`}
    >
      {!imgFailed ? (
        <img
          src="/logo.svg"
          alt="Logo Ju Nail Designer"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="font-serif font-semibold text-[#7A2E4D] text-base tracking-tight">
          Ju
        </span>
      )}
    </div>
  );
};
