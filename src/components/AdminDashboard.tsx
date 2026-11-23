import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { LogOut } from 'lucide-react';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { ensureStudioConfigExists } from '../lib/firestoreService';
import { formatBRL, getTodayDateStr } from '../lib/formatters';
import {
  DEFAULT_STUDIO_CONFIG,
  type Appointment,
  type ClientProfile,
  type Closure,
  type FinanceEntry,
  type StudioConfig,
} from '../types';
import { AdminAgendaTab } from './AdminAgendaTab';
import { AdminClientsTab } from './AdminClientsTab';
import { AdminClosuresTab } from './AdminClosuresTab';
import { AdminFinancesTab } from './AdminFinancesTab';
import { AdminStudioPixTab } from './AdminStudioPixTab';
import { BrandLogo } from './BrandLogo';

interface AdminDashboardProps {
  onSignedOut: () => void;
}

type AdminTab = 'agenda' | 'clients' | 'closures' | 'finances' | 'studio';

const ADMIN_TABS: { id: AdminTab; label: string }[] = [
  { id: 'agenda', label: 'Agenda Geral' },
  { id: 'clients', label: 'Clientes' },
  { id: 'closures', label: 'Bloqueios' },
  { id: 'finances', label: 'Financeiro' },
  { id: 'studio', label: 'Salão & Pix' },
];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onSignedOut,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('agenda');
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [finances, setFinances] = useState<FinanceEntry[]>([]);

  useEffect(() => {
    void ensureStudioConfigExists().catch(() => {});

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

    const unsubAppointments = onSnapshot(
      collection(db, 'appointments'),
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

    const unsubClients = onSnapshot(
      collection(db, 'clients'),
      (snap) => {
        setClients(snap.docs.map((d) => d.data() as ClientProfile));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'clients')
    );

    const unsubClosures = onSnapshot(
      collection(db, 'closures'),
      (snap) => {
        setClosures(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Closure, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'closures')
    );

    const unsubFinances = onSnapshot(
      collection(db, 'finances'),
      (snap) => {
        setFinances(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<FinanceEntry, 'id'>),
          }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'finances')
    );

    return () => {
      unsubConfig();
      unsubAppointments();
      unsubClients();
      unsubClosures();
      unsubFinances();
    };
  }, []);

  const kpis = useMemo(() => {
    const today = getTodayDateStr();
    const monthPrefix = today.slice(0, 7);

    const confirmedToday = appointments.filter(
      (a) => a.date === today && a.status === 'confirmed'
    ).length;

    const totalClients = clients.length;

    const monthRevenue = finances
      .filter((f) => f.date?.startsWith(monthPrefix))
      .reduce((acc, f) => acc + (Number(f.amount) || 0), 0);

    const pendingFees = appointments
      .filter((a) => a.status === 'cancelled_fee_pending')
      .reduce((acc, a) => acc + (Number(a.cancellationFee) || 0), 0);

    const pendingFeesCount = appointments.filter(
      (a) => a.status === 'cancelled_fee_pending'
    ).length;

    return {
      confirmedToday,
      totalClients,
      monthRevenue,
      pendingFees,
      pendingFeesCount,
    };
  }, [appointments, clients, finances]);

  const handleLogout = async () => {
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    onSignedOut();
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
      {/* Top Bar Contract: Brand | 5 Single-line Nav Links | Sair */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#E4E2E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          <div className="flex items-center gap-2.5 shrink-0">
            <BrandLogo size="sm" />
            <span className="font-serif text-xl font-semibold text-[#16141C] whitespace-nowrap shrink-0">
              {config.studioName}
            </span>
          </div>

          <nav
            aria-label="Navegação administrativa"
            className="hidden lg:flex items-center gap-6 text-sm font-medium"
          >
            {ADMIN_TABS.map((tab) => {
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

        {/* Tablet/Mobile Scrollable Tab Bar */}
        <div className="lg:hidden border-t border-[#E4E2E8] bg-white overflow-x-auto">
          <div className="flex items-center px-2 min-w-max">
            {ADMIN_TABS.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'border-[#7A2E4D] text-[#7A2E4D] bg-[#F7EFF2]/40'
                      : 'border-transparent text-[#5E5B66]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-7 sm:py-9 space-y-8">
        {/* Studio Management Header & Real-Time KPI Strip */}
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <BrandLogo size="md" />
              <div>
                <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-[#16141C] leading-none">
                  Gestão do Estúdio
                </h1>
                <p className="text-xs text-[#5E5B66] mt-1">
                  {config.studioName} · {config.subtitle}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#E4E2E8] rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-[#5E5B66]">Confirmados hoje</p>
              <p className="tabular-mono text-2xl sm:text-3xl font-semibold text-[#16141C] mt-1">
                {kpis.confirmedToday}
              </p>
            </div>

            <div className="bg-white border border-[#E4E2E8] rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-[#5E5B66]">Clientes cadastradas</p>
              <p className="tabular-mono text-2xl sm:text-3xl font-semibold text-[#16141C] mt-1">
                {kpis.totalClients}
              </p>
            </div>

            <div className="bg-white border border-[#E4E2E8] rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-[#5E5B66]">Faturamento do mês</p>
              <p className="tabular-mono text-2xl sm:text-3xl font-semibold text-[#7A2E4D] mt-1">
                {formatBRL(kpis.monthRevenue)}
              </p>
            </div>

            <div className="bg-white border border-[#E4E2E8] rounded-2xl p-4 sm:p-5">
              <p className="text-xs text-[#5E5B66]">
                Taxas pendentes ({kpis.pendingFeesCount})
              </p>
              <p
                className={`tabular-mono text-2xl sm:text-3xl font-semibold mt-1 ${
                  kpis.pendingFees > 0 ? 'text-red-700' : 'text-[#16141C]'
                }`}
              >
                {formatBRL(kpis.pendingFees)}
              </p>
            </div>
          </div>
        </section>

        {/* Active Admin Tab */}
        {activeTab === 'agenda' && (
          <AdminAgendaTab
            appointments={appointments}
            clients={clients}
            config={config}
          />
        )}

        {activeTab === 'clients' && <AdminClientsTab clients={clients} />}

        {activeTab === 'closures' && (
          <AdminClosuresTab closures={closures} config={config} />
        )}

        {activeTab === 'finances' && (
          <AdminFinancesTab finances={finances} config={config} />
        )}

        {activeTab === 'studio' && <AdminStudioPixTab config={config} />}
      </main>
    </div>
  );
};
