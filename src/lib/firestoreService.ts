import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  buildLockId,
  buildSlotId,
  generateSafeId,
  getTodayDateStr,
} from './formatters';
import {
  DEFAULT_STUDIO_CONFIG,
  type Appointment,
  type ClientProfile,
  type Closure,
  type ClosureType,
  type FinanceEntry,
  type FinanceType,
  type PaymentMethod,
  type ServiceItem,
  type StudioConfig,
} from '../types';

function clamp(str: string, max: number): string {
  return (str || '').trim().slice(0, max);
}

function clampNum(n: number, min: number, max: number): number {
  const num = Number.isFinite(n) ? n : 0;
  return Math.min(max, Math.max(min, Math.round(num * 100) / 100));
}

export async function ensureAdminDoc(
  uid: string,
  username: string,
  email: string
): Promise<void> {
  const path = `admins/${uid}`;
  try {
    const ref = doc(db, 'admins', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: clamp(uid, 128),
        username: clamp(username || 'Jurosaneli', 60),
        email: clamp(email || '', 160),
        role: 'owner',
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function checkIsAdminDoc(uid: string): Promise<boolean> {
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function ensureStudioConfigExists(): Promise<void> {
  const path = 'studio/config';
  try {
    const ref = doc(db, 'studio', 'config');
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await saveStudioConfig(DEFAULT_STUDIO_CONFIG);
    } else {
      const data = snap.data() as Partial<StudioConfig>;
      if (data.studioName?.trim().toLowerCase() === 'byannenails') {
        await saveStudioConfig({
          ...DEFAULT_STUDIO_CONFIG,
          ...data,
          studioName: 'Ju Nail Designer',
          email:
            data.email === 'contato@byannenails.com.br'
              ? 'contato@junaildesigner.com.br'
              : data.email || DEFAULT_STUDIO_CONFIG.email,
          instagram:
            data.instagram === '@byannenails'
              ? '@junaildesigner'
              : data.instagram || DEFAULT_STUDIO_CONFIG.instagram,
          pixKey:
            data.pixKey === 'contato@byannenails.com.br'
              ? 'contato@junaildesigner.com.br'
              : data.pixKey || DEFAULT_STUDIO_CONFIG.pixKey,
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function saveStudioConfig(config: StudioConfig): Promise<void> {
  const path = 'studio/config';
  const cleanedHours = Array.from(
    new Set(
      (config.workingHours || [])
        .map((h) => h.trim())
        .filter((h) => /^[0-9]{2}:[0-9]{2}$/.test(h))
    )
  )
    .sort()
    .slice(0, 24);

  const cleanedServices: ServiceItem[] = (config.services || [])
    .slice(0, 30)
    .map((s) => ({
      id: clamp(s.id || generateSafeId('srv'), 80).replace(/[^a-zA-Z0-9_-]/g, ''),
      name: clamp(s.name, 120) || 'Procedimento',
      durationMinutes: clampNum(Number(s.durationMinutes) || 60, 15, 480),
      price: clampNum(Number(s.price) || 0, 0, 50000),
    }));

  const payload = {
    studioName: clamp(config.studioName || 'Ju Nail Designer', 100),
    subtitle: clamp(config.subtitle || 'Banho de Gel · Esmaltação', 120),
    address: clamp(config.address, 250),
    referencePoint: clamp(config.referencePoint, 200),
    googleMapsUrl: clamp(config.googleMapsUrl, 500),
    whatsapp: clamp(config.whatsapp, 30),
    email: clamp(config.email, 160),
    instagram: clamp(config.instagram, 160),
    bookingFee: clampNum(Number(config.bookingFee) || 0, 0, 10000),
    cancellationFee: clampNum(Number(config.cancellationFee) || 0, 0, 10000),
    pixKey: clamp(config.pixKey, 140),
    pixHolder: clamp(config.pixHolder, 80),
    pixCity: clamp(config.pixCity, 40),
    workingHours: cleanedHours,
    services: cleanedServices,
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'studio', 'config'), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function createSelfClientProfile(input: {
  uid: string;
  name: string;
  phone: string;
  email: string;
}): Promise<void> {
  const path = `clients/${input.uid}`;
  try {
    const ref = doc(db, 'clients', input.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        uid: clamp(input.uid, 128),
        name: clamp(input.name || 'Cliente', 120),
        phone: clamp(input.phone || '(00) 00000-0000', 30),
        email: clamp(input.email || '', 160),
        notes: '',
        isManual: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function updateOwnClientProfile(
  uid: string,
  updates: { name: string; phone: string; email: string; notes?: string }
): Promise<void> {
  const path = `clients/${uid}`;
  try {
    await updateDoc(doc(db, 'clients', uid), {
      name: clamp(updates.name, 120),
      phone: clamp(updates.phone, 30),
      email: clamp(updates.email, 160),
      notes: clamp(updates.notes ?? '', 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminCreateClient(input: {
  name: string;
  phone: string;
  email: string;
  notes: string;
}): Promise<ClientProfile> {
  const id = generateSafeId('cli');
  const path = `clients/${id}`;
  const payload = {
    uid: id,
    name: clamp(input.name, 120),
    phone: clamp(input.phone, 30),
    email: clamp(input.email, 160),
    notes: clamp(input.notes, 500),
    isManual: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'clients', id), payload);
    return {
      uid: id,
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      notes: payload.notes,
      isManual: true,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function adminUpdateClient(
  clientId: string,
  input: { name: string; phone: string; email: string; notes: string }
): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    await updateDoc(doc(db, 'clients', clientId), {
      name: clamp(input.name, 120),
      phone: clamp(input.phone, 30),
      email: clamp(input.email, 160),
      notes: clamp(input.notes, 500),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, path);
  }
}

export async function adminDeleteClient(clientId: string): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export interface CreateAppointmentInput {
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  date: string;
  time: string;
  service: ServiceItem;
  bookingFee: number;
  paymentMethod: PaymentMethod;
  notes: string;
  createdBy: 'client' | 'admin';
}

export async function createAppointmentAtomic(
  input: CreateAppointmentInput
): Promise<Appointment> {
  const appointmentId = generateSafeId('apt');
  const slotId = buildSlotId(input.date, input.time);
  const lockId = buildLockId(input.clientId, input.date);

  // Pre-check slot & day lock to provide clear user-facing errors
  const slotRef = doc(db, 'slots', slotId);
  const lockRef = doc(db, 'clientDayLocks', lockId);
  const aptRef = doc(db, 'appointments', appointmentId);

  try {
    const slotSnap = await getDoc(slotRef);
    if (slotSnap.exists()) {
      throw new Error('SLOT_TAKEN');
    }
    if (input.createdBy === 'client') {
      const lockSnap = await getDoc(lockRef);
      if (lockSnap.exists()) {
        throw new Error('DAY_LOCKED');
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message === 'SLOT_TAKEN' || err.message === 'DAY_LOCKED')
    ) {
      throw err;
    }
    handleFirestoreError(err, OperationType.GET, `slots/${slotId}`);
  }

  const batch = writeBatch(db);
  const nowTs = serverTimestamp();

  const aptPayload = {
    clientId: clamp(input.clientId, 128),
    clientName: clamp(input.clientName, 120),
    clientPhone: clamp(input.clientPhone, 30),
    clientEmail: clamp(input.clientEmail, 160),
    date: input.date,
    time: input.time,
    slotId,
    lockId,
    serviceId: clamp(input.service.id, 80).replace(/[^a-zA-Z0-9_-]/g, '') || 'service',
    serviceName: clamp(input.service.name, 120),
    serviceDuration: clampNum(input.service.durationMinutes, 15, 480),
    servicePrice: clampNum(input.service.price, 0, 50000),
    bookingFee: clampNum(input.bookingFee, 0, 10000),
    bookingFeePaid: false,
    paymentMethod: input.paymentMethod,
    notes: clamp(input.notes, 500),
    status: 'confirmed' as const,
    cancellationFee: 0,
    createdBy: input.createdBy,
    createdAt: nowTs,
    updatedAt: nowTs,
  };

  batch.set(aptRef, aptPayload);
  batch.set(slotRef, {
    date: input.date,
    time: input.time,
    appointmentId,
    clientId: aptPayload.clientId,
    status: 'booked',
    createdAt: nowTs,
  });

  // Always create day lock for client bookings; for admin bookings create if not already locked
  if (input.createdBy === 'client') {
    batch.set(lockRef, {
      clientId: aptPayload.clientId,
      date: input.date,
      appointmentId,
      createdAt: nowTs,
    });
  } else {
    const existingLock = await getDoc(lockRef).catch(() => null);
    if (!existingLock || !existingLock.exists()) {
      batch.set(lockRef, {
        clientId: aptPayload.clientId,
        date: input.date,
        appointmentId,
        createdAt: nowTs,
      });
    }
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `appointments/${appointmentId}`);
  }

  return {
    id: appointmentId,
    ...aptPayload,
    createdAt: null,
    updatedAt: null,
  };
}

export async function cancelAppointmentAtomic(
  appointment: Appointment,
  cancellationFee: number
): Promise<Appointment> {
  const hasFee = cancellationFee > 0;
  const newStatus = hasFee ? 'cancelled_fee_pending' : 'cancelled_free';
  const feeValue = hasFee ? clampNum(cancellationFee, 0, 10000) : 0;

  const aptRef = doc(db, 'appointments', appointment.id);
  const slotRef = doc(db, 'slots', appointment.slotId);
  const lockRef = doc(db, 'clientDayLocks', appointment.lockId);

  const batch = writeBatch(db);
  batch.update(aptRef, {
    status: newStatus,
    cancellationFee: feeValue,
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Only delete slot / lock if they exist and belong to this appointment
  try {
    const slotSnap = await getDoc(slotRef);
    if (slotSnap.exists() && slotSnap.data()?.appointmentId === appointment.id) {
      batch.delete(slotRef);
    }
  } catch {
    // ignore read failure on optional cleanup
  }

  try {
    const lockSnap = await getDoc(lockRef);
    if (lockSnap.exists() && lockSnap.data()?.appointmentId === appointment.id) {
      batch.delete(lockRef);
    }
  } catch {
    // ignore read failure on optional cleanup
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointment.id}`);
  }

  return {
    ...appointment,
    status: newStatus,
    cancellationFee: feeValue,
  };
}

export async function completeAppointmentAndRecordFinance(
  appointment: Appointment,
  paymentMethodOverride?: PaymentMethod
): Promise<void> {
  const aptRef = doc(db, 'appointments', appointment.id);
  const financeId = generateSafeId('fin');
  const finRef = doc(db, 'finances', financeId);
  const method = paymentMethodOverride || appointment.paymentMethod;

  const batch = writeBatch(db);
  batch.update(aptRef, {
    status: 'completed',
    bookingFeePaid: true,
    paymentMethod: method,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  if (appointment.servicePrice > 0) {
    batch.set(finRef, {
      type: 'service' as FinanceType,
      description: clamp(`Atendimento: ${appointment.serviceName}`, 200),
      clientName: clamp(appointment.clientName, 120),
      amount: clampNum(appointment.servicePrice, 0.01, 100000),
      paymentMethod: method,
      date: appointment.date || getTodayDateStr(),
      appointmentId: appointment.id,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
}

export async function confirmCancellationFeePaid(
  appointment: Appointment,
  paymentMethod: PaymentMethod = 'pix'
): Promise<void> {
  const aptRef = doc(db, 'appointments', appointment.id);
  const financeId = generateSafeId('fin');
  const finRef = doc(db, 'finances', financeId);

  const batch = writeBatch(db);
  batch.update(aptRef, {
    status: 'cancelled_fee_paid',
    updatedAt: serverTimestamp(),
  });

  if (appointment.cancellationFee > 0) {
    batch.set(finRef, {
      type: 'cancellation_fee' as FinanceType,
      description: clamp(
        `Taxa de cancelamento (${appointment.serviceName})`,
        200
      ),
      clientName: clamp(appointment.clientName, 120),
      amount: clampNum(appointment.cancellationFee, 0.01, 100000),
      paymentMethod,
      date: getTodayDateStr(),
      appointmentId: appointment.id,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${appointment.id}`);
  }
}

export async function adminUpdateAppointmentAtomic(
  original: Appointment,
  updates: {
    date: string;
    time: string;
    service: ServiceItem;
    paymentMethod: PaymentMethod;
    notes: string;
    bookingFeePaid: boolean;
  }
): Promise<void> {
  const newSlotId = buildSlotId(updates.date, updates.time);
  const newLockId = buildLockId(original.clientId, updates.date);
  const slotChanged = newSlotId !== original.slotId;
  const dateChanged = updates.date !== original.date;

  if (slotChanged && original.status === 'confirmed') {
    const targetSlotSnap = await getDoc(doc(db, 'slots', newSlotId));
    if (
      targetSlotSnap.exists() &&
      targetSlotSnap.data()?.appointmentId !== original.id
    ) {
      throw new Error('SLOT_TAKEN');
    }
  }

  const batch = writeBatch(db);
  const aptRef = doc(db, 'appointments', original.id);

  batch.update(aptRef, {
    date: updates.date,
    time: updates.time,
    slotId: newSlotId,
    lockId: newLockId,
    serviceId: clamp(updates.service.id, 80).replace(/[^a-zA-Z0-9_-]/g, '') || 'service',
    serviceName: clamp(updates.service.name, 120),
    serviceDuration: clampNum(updates.service.durationMinutes, 15, 480),
    servicePrice: clampNum(updates.service.price, 0, 50000),
    paymentMethod: updates.paymentMethod,
    notes: clamp(updates.notes, 500),
    bookingFeePaid: updates.bookingFeePaid,
    updatedAt: serverTimestamp(),
  });

  if (slotChanged && original.status === 'confirmed') {
    const oldSlotSnap = await getDoc(doc(db, 'slots', original.slotId)).catch(() => null);
    if (oldSlotSnap?.exists() && oldSlotSnap.data()?.appointmentId === original.id) {
      batch.delete(doc(db, 'slots', original.slotId));
    }
    batch.set(doc(db, 'slots', newSlotId), {
      date: updates.date,
      time: updates.time,
      appointmentId: original.id,
      clientId: original.clientId,
      status: 'booked',
      createdAt: serverTimestamp(),
    });
  }

  if (dateChanged && original.status === 'confirmed') {
    const oldLockSnap = await getDoc(doc(db, 'clientDayLocks', original.lockId)).catch(() => null);
    if (oldLockSnap?.exists() && oldLockSnap.data()?.appointmentId === original.id) {
      batch.delete(doc(db, 'clientDayLocks', original.lockId));
    }
    batch.set(doc(db, 'clientDayLocks', newLockId), {
      clientId: original.clientId,
      date: updates.date,
      appointmentId: original.id,
      createdAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `appointments/${original.id}`);
  }
}

export async function adminDeleteAppointmentAtomic(
  appointment: Appointment
): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, 'appointments', appointment.id));

  const slotSnap = await getDoc(doc(db, 'slots', appointment.slotId)).catch(() => null);
  if (slotSnap?.exists() && slotSnap.data()?.appointmentId === appointment.id) {
    batch.delete(doc(db, 'slots', appointment.slotId));
  }

  const lockSnap = await getDoc(doc(db, 'clientDayLocks', appointment.lockId)).catch(() => null);
  if (lockSnap?.exists() && lockSnap.data()?.appointmentId === appointment.id) {
    batch.delete(doc(db, 'clientDayLocks', appointment.lockId));
  }

  try {
    await batch.commit();
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `appointments/${appointment.id}`);
  }
}

export async function createClosure(input: {
  type: ClosureType;
  startDate: string;
  endDate: string;
  time: string;
  reason: string;
}): Promise<Closure> {
  const id = generateSafeId('cls');
  const path = `closures/${id}`;
  const payload = {
    type: input.type,
    startDate: input.startDate,
    endDate: input.endDate,
    time: input.type === 'slot' ? input.time : '',
    reason: clamp(input.reason || 'Agenda bloqueada pela proprietária', 200),
    active: true,
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'closures', id), payload);
    return { id, ...payload, createdAt: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteClosure(closureId: string): Promise<void> {
  const path = `closures/${closureId}`;
  try {
    await deleteDoc(doc(db, 'closures', closureId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function createFinanceEntry(input: {
  type: FinanceType;
  description: string;
  clientName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  date: string;
  appointmentId?: string;
}): Promise<FinanceEntry> {
  const id = generateSafeId('fin');
  const path = `finances/${id}`;
  const payload = {
    type: input.type,
    description: clamp(input.description, 200),
    clientName: clamp(input.clientName, 120),
    amount: clampNum(input.amount, 0.01, 100000),
    paymentMethod: input.paymentMethod,
    date: input.date || getTodayDateStr(),
    appointmentId: clamp(input.appointmentId || '', 128),
    createdAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'finances', id), payload);
    return { id, ...payload, createdAt: null };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteFinanceEntry(financeId: string): Promise<void> {
  const path = `finances/${financeId}`;
  try {
    await deleteDoc(doc(db, 'finances', financeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function getClientsCollection() {
  return collection(db, 'clients');
}
