import type { Timestamp } from 'firebase/firestore';

export type PaymentMethod = 'pix' | 'credit' | 'debit' | 'cash';

export type AppointmentStatus =
  | 'confirmed'
  | 'completed'
  | 'cancelled_free'
  | 'cancelled_fee_pending'
  | 'cancelled_fee_paid';

export type ClosureType = 'day' | 'week' | 'slot';

export type FinanceType = 'service' | 'cancellation_fee' | 'booking_fee';

export interface ServiceItem {
  id: string;
  name: string;
  durationMinutes: number;
  price: number;
}

export interface StudioConfig {
  studioName: string;
  subtitle: string;
  address: string;
  referencePoint: string;
  googleMapsUrl: string;
  whatsapp: string;
  email: string;
  instagram: string;
  bookingFee: number;
  cancellationFee: number;
  pixKey: string;
  pixHolder: string;
  pixCity: string;
  workingHours: string[];
  services: ServiceItem[];
  updatedAt?: Timestamp | null;
}

export interface ClientProfile {
  uid: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  isManual: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  slotId: string; // YYYY-MM-DD_HH-MM
  lockId: string; // {clientId}_{YYYY-MM-DD}
  serviceId: string;
  serviceName: string;
  serviceDuration: number;
  servicePrice: number;
  bookingFee: number;
  bookingFeePaid: boolean;
  paymentMethod: PaymentMethod;
  notes: string;
  status: AppointmentStatus;
  cancellationFee: number;
  cancelledAt?: Timestamp | null;
  completedAt?: Timestamp | null;
  createdBy: 'client' | 'admin';
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SlotDoc {
  id: string;
  date: string;
  time: string;
  appointmentId: string;
  clientId: string;
  status: 'booked';
  createdAt?: Timestamp | null;
}

export interface ClientDayLock {
  id: string;
  clientId: string;
  date: string;
  appointmentId: string;
  createdAt?: Timestamp | null;
}

export interface Closure {
  id: string;
  type: ClosureType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  time: string; // '' for day/week, 'HH:MM' for slot
  reason: string;
  active: boolean;
  createdAt?: Timestamp | null;
}

export interface FinanceEntry {
  id: string;
  type: FinanceType;
  description: string;
  clientName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string; // YYYY-MM-DD
  appointmentId: string;
  createdAt?: Timestamp | null;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: 'Pix',
  credit: 'Cartão de Crédito',
  debit: 'Cartão de Débito',
  cash: 'Dinheiro',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled_free: 'Cancelado gratuitamente',
  cancelled_fee_pending: 'Cancelado · taxa pendente',
  cancelled_fee_paid: 'Cancelado · taxa paga',
};

export const FINANCE_TYPE_LABELS: Record<FinanceType, string> = {
  service: 'Atendimento',
  cancellation_fee: 'Taxa de Cancelamento',
  booking_fee: 'Taxa de Reserva',
};

export const DEFAULT_SERVICES: ServiceItem[] = [
  {
    id: 'banho_de_gel_natural',
    name: 'Banho de Gel Natural',
    durationMinutes: 90,
    price: 120,
  },
  {
    id: 'manutencao_alongamento',
    name: 'Manutenção de Alongamento',
    durationMinutes: 90,
    price: 130,
  },
  {
    id: 'esmaltacao_em_gel',
    name: 'Esmaltação em Gel',
    durationMinutes: 60,
    price: 85,
  },
  {
    id: 'spa_pes_esmaltacao',
    name: 'Spa dos Pés + Esmaltação',
    durationMinutes: 75,
    price: 95,
  },
];

export const DEFAULT_WORKING_HOURS: string[] = [
  '08:30',
  '10:00',
  '11:30',
  '13:30',
  '15:00',
  '16:30',
  '18:00',
];

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  studioName: 'Ju Nail Designer',
  subtitle: 'Banho de Gel · Esmaltação',
  address: 'Rua das Flores, 240 — Sala 12, Centro',
  referencePoint: 'Próximo à Praça Central, edifício com fachada bege',
  googleMapsUrl:
    'https://www.google.com/maps/search/?api=1&query=Rua+das+Flores+240+Centro',
  whatsapp: '(11) 99999-0000',
  email: 'contato@junaildesigner.com.br',
  instagram: '@junaildesigner',
  bookingFee: 30,
  cancellationFee: 35,
  pixKey: 'contato@junaildesigner.com.br',
  pixHolder: 'JU NAIL DESIGNER',
  pixCity: 'SAO PAULO',
  workingHours: DEFAULT_WORKING_HOURS,
  services: DEFAULT_SERVICES,
};

export const STUDIO_HERO_IMAGE =
  '/src/assets/images/studio_hero_environment_1795437835498.jpg';
export const STUDIO_LOCATION_IMAGE =
  '/src/assets/images/studio_location_interior_1795437835784.jpg';

export const PASSWORD_RESET_REDIRECT_URL = 'https://agendanails-psi.vercel.app/';
export const ADMIN_USERNAME = 'Jurosaneli';
export const ADMIN_INTERNAL_EMAIL = 'admin@junaildesigner.app';
export const BOOTSTRAPPED_ADMIN_EMAIL = 'egabi4125@gmail.com';
