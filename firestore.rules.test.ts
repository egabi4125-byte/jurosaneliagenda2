/**
 * Phase 0 Security TDD Specification — Ju Nail Designer Firestore Rules
 * Verifies that all "Dirty Dozen" adversarial payloads return PERMISSION_DENIED.
 *
 * Run against Firebase Local Emulator Suite when available:
 *   firebase emulators:exec --only firestore "npx vitest run firestore.rules.test.ts"
 */

export interface DirtyDozenCase {
  id: string;
  name: string;
  actor: 'unauthenticated' | 'clientA' | 'unverifiedAdminSpoof' | 'admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 'P1',
    name: 'Shadow Field Injection on Client Profile',
    actor: 'clientA',
    operation: 'create',
    path: 'clients/clientA',
    payload: {
      uid: 'clientA',
      name: 'Maria Silva',
      phone: '11999998888',
      email: 'maria@example.com',
      notes: '',
      isManual: false,
      isAdmin: true, // Ghost field
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P2',
    name: 'Identity Spoofing on Appointment',
    actor: 'clientA',
    operation: 'create',
    path: 'appointments/apt_spoof_1',
    payload: {
      clientId: 'clientB', // Spoofed owner
      clientName: 'Ana Paula',
      clientPhone: '11988887777',
      clientEmail: 'ana@example.com',
      date: '2026-12-01',
      time: '10:00',
      slotId: '2026-12-01_10-00',
      lockId: 'clientB_2026-12-01',
      serviceId: 'banho_gel',
      serviceName: 'Banho de Gel Natural',
      serviceDuration: 90,
      servicePrice: 120,
      bookingFee: 30,
      bookingFeePaid: false,
      paymentMethod: 'pix',
      notes: '',
      status: 'confirmed',
      cancellationFee: 0,
      createdBy: 'client',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P3',
    name: 'Orphaned Appointment Without Atomic Slot and DayLock',
    actor: 'clientA',
    operation: 'create',
    path: 'appointments/apt_orphan_1',
    payload: {
      clientId: 'clientA',
      date: '2026-12-02',
      time: '14:00',
      slotId: '2026-12-02_14-00',
      lockId: 'clientA_2026-12-02',
      status: 'confirmed',
      createdBy: 'client',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P4',
    name: 'Privilege Escalation via Admin Collection',
    actor: 'clientA',
    operation: 'create',
    path: 'admins/clientA',
    payload: {
      uid: 'clientA',
      username: 'owner_spoof',
      email: 'clienta@example.com',
      role: 'owner',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P5',
    name: 'Email Spoofing Without Verification on Studio Config',
    actor: 'unverifiedAdminSpoof',
    operation: 'update',
    path: 'studio/config',
    payload: {
      studioName: 'Hacked Studio',
      pixKey: 'attacker@pix.com',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P6',
    name: 'PII Scraping on Another Client Profile',
    actor: 'clientA',
    operation: 'get',
    path: 'clients/clientB',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P7',
    name: 'Client Reading Financial Ledger',
    actor: 'clientA',
    operation: 'list',
    path: 'finances',
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P8',
    name: 'Terminal State Tampering on Cancelled Appointment',
    actor: 'clientA',
    operation: 'update',
    path: 'appointments/apt_cancelled_1',
    payload: {
      status: 'completed',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P9',
    name: 'Value Poisoning on Client Cancel Update',
    actor: 'clientA',
    operation: 'update',
    path: 'appointments/apt_confirmed_1',
    payload: {
      status: 'cancelled_free',
      servicePrice: 0,
      bookingFeePaid: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P10',
    name: 'Resource Poisoning (Oversized Notes & Invalid Doc ID)',
    actor: 'clientA',
    operation: 'update',
    path: 'clients/clientA',
    payload: {
      notes: 'X'.repeat(5000),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P11',
    name: 'Client Forging Schedule Closure',
    actor: 'clientA',
    operation: 'create',
    path: 'closures/closure_fake',
    payload: {
      type: 'day',
      startDate: '2026-12-10',
      endDate: '2026-12-10',
      time: '',
      reason: 'Fechado falso',
      active: true,
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 'P12',
    name: 'Deleting Another Client Slot',
    actor: 'clientA',
    operation: 'delete',
    path: 'slots/2026-12-01_10-00',
    expectedResult: 'PERMISSION_DENIED',
  },
];
