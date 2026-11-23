import React from 'react';
import { motion } from 'motion/react';
import { BrandLogo } from './BrandLogo';

interface SplashScreenProps {
  studioName?: string;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  studioName = 'Ju Nail Designer',
}) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-50 bg-[#FAFAFA] flex flex-col items-center justify-center px-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center"
      >
        <BrandLogo size="xl" className="mb-5 shadow-sm" />
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-[#16141C]">
          {studioName}
        </h1>
        <p className="mt-1 text-xs tracking-wide text-[#5E5B66]">
          Banho de Gel · Esmaltação
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <div className="w-36 h-[2px] bg-[#E4E2E8] overflow-hidden rounded-full">
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                repeat: Infinity,
                duration: 1.15,
                ease: 'easeInOut',
              }}
              className="w-1/2 h-full bg-[#7A2E4D] rounded-full"
            />
          </div>
          <p className="text-sm text-[#5E5B66]">Entrando no site...</p>
        </div>
      </motion.div>
    </motion.div>
  );
};
