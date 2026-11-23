import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { sendEmailVerification, signOut, type User } from 'firebase/auth';
import {
  Instagram,
  LogOut,
  MailCheck,
  RefreshCw,
} from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { normalizeInstagramUrl } from '../lib/formatters';
import {
  DEFAULT_STUDIO_CONFIG,
  PASSWORD_RESET_REDIRECT_URL,
  type Appointment,
  type ClientDayLock,
  type ClientProfile,
  type Closure,
  type SlotDoc,
  type StudioConfig,
} from '../types';
import { BrandLogo } from './BrandLogo';
import { ClientAppointmentsTab } from './ClientAppointmentsTab';
import { ClientBookingTab } from './ClientBookingTab';
import { ClientLocationTab } from './ClientLocationTab';
import { WhatsAppFloatingButton } from './WhatsAppFloatingButton';

interface ClientAreaProps {
  user: User;
  onSignedOut: () => void;
}

type ClientTab = 'agenda' | 'appointments' | 'location';

export const ClientArea: React.FC<ClientAreaProps> = ({ user, onSignedOut }) => {
  const [activeTab, setActiveTab] = useState<ClientTab>('agenda');
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [clientProfile, setClientProfile] = useState<ClientProfile | null>(null);
  const [slots, setSlots] = useState<SlotDoc[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [dayLocks, setDayLocks] = useState<ClientDayLock[]>([]);

  const [emailVerified, setEmailVerified] = useState(user.emailVerified);
  const [resendingVerify, setResendingVerify] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState('');

  useEffect(() => {
    setEmailVerified(user.emailVerified);
  }, [user.emailVerified]);

  // Real-time listeners (authenticated only)
  useEffect(() => {
    const unsubConfig = onSnapshot(
      doc(db, 'studio', 'config'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<StudioConfig>;
          setConfig({
            ...DEFAULT_STUDIO_CONFIG,
            ...data,
            studioName:
              !data.studioName ||
              data.studioName.trim().toLowerCase() === 'byannenails'
                ? 'Ju Nail Designer'
                : data.studioName,
          });
        }
      },
      (err) => handleFirestoreError(err, OperationType.GET, 'studio/config')
    );

    const unsubProfile = onSnapshot(
      doc(db, 'clients', user.uid),
      (snap) => {
        if (snap.exists()) {
          setClientProfile(snap.data() as ClientProfile);
        }
      },
      (err) =>
        handleFirestoreError(err, OperationType.GET, `clients/${user.uid}`)
    );

    const unsubSlots = onSnapshot(
      query(collection(db, 'slots'), where('status', '==', 'booked')),
      (snap) => {
        setSlots(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SlotDoc, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'slots')
    );

    const unsubClosures = onSnapshot(
      query(collection(db, 'closures'), where('active', '==', true)),
      (snap) => {
        setClosures(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Closure, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'closures')
    );

    const unsubAppointments = onSnapshot(
      query(collection(db, 'appointments'), where('clientId', '==', user.uid)),
      (snap) => {
        setAppointments(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Appointment, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'appointments')
    );

    const unsubDayLocks = onSnapshot(
      query(
        collection(db, 'clientDayLocks'),
        where('clientId', '==', user.uid)
      ),
      (snap) => {
        setDayLocks(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ClientDayLock, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'clientDayLocks')
    );

    return () => {
      unsubConfig();
      unsubProfile();
      unsubSlots();
      unsubClosures();
      unsubAppointments();
      unsubDayLocks();
    };
  }, [user.uid]);

  const handleLogout = async () => {
    await signOut(auth);
    onSignedOut();
  };

  const handleResendVerification = async () => {
    setResendingVerify(true);
    setVerifyNotice('');
    try {
      await sendEmailVerification(user, {
        url: PASSWORD_RESET_REDIRECT_URL,
        handleCodeInApp: false,
      });
      setVerifyNotice('E-mail de verificação reenviado! Confira sua caixa de entrada.');
    } catch {
      setVerifyNotice('Aguarde alguns instantes antes de solicitar novo envio.');
    } finally {
      setResendingVerify(false);
    }
  };

  const handleCheckVerification = async () => {
    await user.reload();
    setEmailVerified(Boolean(auth.currentUser?.emailVerified));
    if (auth.currentUser?.emailVerified) {
      setVerifyNotice('E-mail confirmado com sucesso!');
    } else {
      setVerifyNotice('Ainda não identificamos a confirmação. Clique no link enviado ao seu e-mail.');
    }
  };

  const displayName =
    clientProfile?.name || user.displayName || user.email?.split('@')[0] || 'Cliente';
  const firstName = displayName.split(' ')[0];
  const instagramUrl = normalizeInstagramUrl(config.instagram);

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {/* Top Bar Contract: 3 clean zones (Brand | 3 Tabs | Sair) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E4E2E8]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <BrandLogo size="sm" />
            <span className="font-serif text-xl font-semibold text-[#16141C] whitespace-nowrap shrink-0">
              {config.studioName}
            </span>
          </div>

          <nav
            aria-label="Navegação da cliente"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {(
              [
                { id: 'agenda', label: 'Agenda' },
                { id: 'appointments', label: 'Meus Horários' },
                { id: 'location', label: 'Localização' },
              ] as { id: ClientTab; label: string }[]
            ).map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-5 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#7A2E4D] text-[#7A2E4D]'
                      : 'border-transparent text-[#5E5B66] hover:text-[#16141C]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E4E2E8] bg-white hover:bg-[#FAFAFA] text-xs font-medium text-[#16141C] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-[#5E5B66]" />
            Sair
          </button>
        </div>

        {/* Mobile Tab Row */}
        <div className="md:hidden border-t border-[#E4E2E8] grid grid-cols-3 bg-white">
          {(
            [
              { id: 'agenda', label: 'Agenda' },
              { id: 'appointments', label: 'Meus Horários' },
              { id: 'location', label: 'Localização' },
            ] as { id: ClientTab; label: string }[]
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-[#7A2E4D] text-[#7A2E4D] bg-[#F7EFF2]/50'
                    : 'border-transparent text-[#5E5B66]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-7 sm:py-9 pb-24">
        {/* Welcome Header with Client Name + Instagram Button */}
        <section className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-7 border-b border-[#E4E2E8]">
          <div>
            <p className="text-xs text-[#5E5B66]">{config.subtitle}</p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#16141C] mt-0.5">
              Olá, {firstName}
            </h1>
          </div>

          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#7A2E4D]/30 bg-white hover:bg-[#F7EFF2] text-[#7A2E4D] text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              <Instagram className="w-4 h-4" />
              Instagram do Salão
            </a>
          )}
        </section>

        {/* Email Verification Notice (for Email/Password accounts not yet verified) */}
        {!emailVerified && (
          <div className="mb-7 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 leading-relaxed">
                <p className="font-semibold">
                  Confirme seu e-mail ({user.email}) para liberar agendamentos
                </p>
                <p className="mt-0.5 text-amber-900">
                  Enviamos um link de verificação para sua caixa de entrada.
                  Após clicar no link, toque em "Já confirmei".
                </p>
                {verifyNotice && (
                  <p className="mt-1 font-medium text-[#7A2E4D]">{verifyNotice}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={resendingVerify}
                onClick={handleResendVerification}
                className="px-3 py-2 rounded-lg border border-amber-300 bg-white hover:bg-amber-50 text-xs font-medium text-amber-950 whitespace-nowrap cursor-pointer"
              >
                {resendingVerify ? 'Enviando...' : 'Reenviar link'}
              </button>
              <button
                type="button"
                onClick={handleCheckVerification}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7A2E4D] hover:bg-[#61233C] text-white text-xs font-medium whitespace-nowrap cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Já confirmei
              </button>
            </div>
          </div>
        )}

        {/* Active Tab View */}
        {activeTab === 'agenda' && (
          <ClientBookingTab
            user={user}
            clientProfile={clientProfile}
            config={config}
            slots={slots}
            closures={closures}
            dayLocks={dayLocks}
            onGoToAppointments={() => setActiveTab('appointments')}
          />
        )}

        {activeTab === 'appointments' && (
          <ClientAppointmentsTab
            appointments={appointments}
            config={config}
            onBookAnother={() => setActiveTab('agenda')}
          />
        )}

        {activeTab === 'location' && <ClientLocationTab config={config} />}
      </main>

      {/* Floating WhatsApp Button (Logo ONLY, no text) */}
      <WhatsAppFloatingButton
        phone={config.whatsapp}
        studioName={config.studioName}
      />
    </div>
  );
};
