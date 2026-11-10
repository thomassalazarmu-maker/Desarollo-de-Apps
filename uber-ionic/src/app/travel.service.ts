import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService, DemoUser } from './auth.service';

export type RideStatus = 'searching' | 'accepted' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'wallet' | 'card';
export type VehicleCategoryId = 'economico' | 'moto' | 'confort' | 'xl';

export interface RidePoint {
  name: string;
  latitude: number;
  longitude: number;
}

export interface FareCategory {
  id: VehicleCategoryId;
  name: string;
  description: string;
  baseFare: number;
  pricePerKm: number;
  pricePerMinute: number;
  surcharge: number;
  driverSharePercent: number;
}

export interface FareSettings {
  categories: FareCategory[];
  platformCommissionPercent: number;
  additionalSurcharge: number;
  demandMultiplier: number;
  coupons: Record<string, number>;
}

export interface RideQuote {
  categoryId: VehicleCategoryId;
  categoryName: string;
  baseFare: number;
  distanceFare: number;
  timeFare: number;
  surcharge: number;
  discount: number;
  total: number;
  driverEarnings: number;
  platformEarnings: number;
}

export interface DriverSnapshot {
  id: number;
  name: string;
  phone: string;
  rating: number;
  brand: string;
  model: string;
  color: string;
  plate: string;
  photoName?: string;
  latitude: number;
  longitude: number;
}

export interface RideTrip {
  id: string;
  clientId: number;
  clientName: string;
  clientPhone: string;
  origin: RidePoint;
  destination: RidePoint;
  distanceKm: number;
  durationMin: number;
  routeGeometry: [number, number][];
  categoryId: VehicleCategoryId;
  categoryName: string;
  quote: RideQuote;
  finalFare: number | null;
  paymentMethod: PaymentMethod;
  status: RideStatus;
  createdAt: string;
  scheduledAt: string | null;
  driver: DriverSnapshot | null;
  driverId: number | null;
  driverLatitude: number | null;
  driverLongitude: number | null;
  etaMinutes: number | null;
  pin: string;
  rating: number | null;
  comment: string;
  issueReport: string;
  lostItemReport: string;
  couponCode: string;
  rejectedDriverIds: number[];
}

export interface DriverPresence {
  driverId: number;
  available: boolean;
  latitude: number;
  longitude: number;
  updatedAt: string;
}

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia bancaria',
  wallet: 'Billetera digital (simulada)',
  card: 'Tarjeta débito/crédito (simulada)'
};

const TRIPS_KEY = 'huila_go_trips_v1';
const FARES_KEY = 'huila_go_fares_v1';
const PRESENCE_KEY = 'huila_go_driver_presence_v1';
const FAVORITES_KEY = 'huila_go_favorites_v1';

const DEFAULT_FARES: FareSettings = {
  categories: [
    { id: 'economico', name: 'HUILA GO ECONÓMICO', description: 'Viaje cómodo al mejor precio', baseFare: 3200, pricePerKm: 1250, pricePerMinute: 220, surcharge: 0, driverSharePercent: 85 },
    { id: 'moto', name: 'HUILA GO MOTO', description: 'Ágil para llegar más rápido', baseFare: 2200, pricePerKm: 850, pricePerMinute: 160, surcharge: 0, driverSharePercent: 85 },
    { id: 'confort', name: 'HUILA GO CONFORT', description: 'Más espacio y comodidad', baseFare: 5000, pricePerKm: 1600, pricePerMinute: 280, surcharge: 500, driverSharePercent: 82 },
    { id: 'xl', name: 'HUILA GO XL', description: 'Espacio para grupos y equipaje', baseFare: 6500, pricePerKm: 1900, pricePerMinute: 320, surcharge: 1200, driverSharePercent: 80 }
  ],
  platformCommissionPercent: 15,
  additionalSurcharge: 0,
  demandMultiplier: 1,
  coupons: { HUILA10: 10 }
};

@Injectable({ providedIn: 'root' })
export class TravelService {
  private readonly tripsSubject = new BehaviorSubject<RideTrip[]>(this.read<RideTrip[]>(TRIPS_KEY, []));
  readonly trips$ = this.tripsSubject.asObservable();
  private readonly presenceSubject = new BehaviorSubject<DriverPresence[]>(this.read<DriverPresence[]>(PRESENCE_KEY, []));
  readonly presence$ = this.presenceSubject.asObservable();
  private readonly faresSubject = new BehaviorSubject<FareSettings>(this.read<FareSettings>(FARES_KEY, DEFAULT_FARES));
  readonly fares$ = this.faresSubject.asObservable();

  constructor(private readonly auth: AuthService) {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', event => {
        if (event.key === TRIPS_KEY) this.tripsSubject.next(this.read<RideTrip[]>(TRIPS_KEY, []));
        if (event.key === PRESENCE_KEY) this.presenceSubject.next(this.read<DriverPresence[]>(PRESENCE_KEY, []));
        if (event.key === FARES_KEY) this.faresSubject.next(this.read<FareSettings>(FARES_KEY, DEFAULT_FARES));
      });
    }
  }

  get trips(): RideTrip[] {
    return this.tripsSubject.value;
  }

  get fareSettings(): FareSettings {
    return this.read<FareSettings>(FARES_KEY, DEFAULT_FARES);
  }

  saveFareSettings(settings: FareSettings): void {
    this.write(FARES_KEY, settings);
    this.faresSubject.next(settings);
  }

  quote(distanceKm: number, durationMin: number, categoryId: VehicleCategoryId, couponCode = ''): RideQuote {
    const settings = this.fareSettings;
    const category = settings.categories.find(item => item.id === categoryId);
    if (!category) throw new Error('La categoría seleccionada no tiene tarifa configurada.');

    const baseFare = Math.round(category.baseFare);
    const distanceFare = Math.round(distanceKm * category.pricePerKm);
    const timeFare = Math.round(durationMin * category.pricePerMinute);
    const surcharge = Math.round(category.surcharge + settings.additionalSurcharge);
    const subtotal = (baseFare + distanceFare + timeFare + surcharge) * settings.demandMultiplier;
    const discountPercent = settings.coupons[couponCode.trim().toUpperCase()] || 0;
    const discount = Math.round(subtotal * discountPercent / 100);
    const total = Math.max(0, Math.round(subtotal - discount));
    const driverEarnings = Math.round(total * (100 - settings.platformCommissionPercent) / 100);

    return {
      categoryId,
      categoryName: category.name,
      baseFare,
      distanceFare,
      timeFare,
      surcharge,
      discount,
      total,
      driverEarnings,
      platformEarnings: total - driverEarnings
    };
  }

  createTrip(input: {
    client: DemoUser;
    origin: RidePoint;
    destination: RidePoint;
    distanceKm: number;
    durationMin: number;
    routeGeometry: [number, number][];
    categoryId: VehicleCategoryId;
    paymentMethod: PaymentMethod;
    couponCode?: string;
    scheduledAt?: string | null;
  }): RideTrip {
    const quote = this.quote(input.distanceKm, input.durationMin, input.categoryId, input.couponCode);
    const category = this.fareSettings.categories.find(item => item.id === input.categoryId)!;
    const trip: RideTrip = {
      id: `HG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      clientId: input.client.id,
      clientName: input.client.name,
      clientPhone: input.client.phone,
      origin: input.origin,
      destination: input.destination,
      distanceKm: input.distanceKm,
      durationMin: input.durationMin,
      routeGeometry: input.routeGeometry,
      categoryId: input.categoryId,
      categoryName: category.name,
      quote,
      finalFare: null,
      paymentMethod: input.paymentMethod,
      status: 'searching',
      createdAt: new Date().toISOString(),
      scheduledAt: input.scheduledAt || null,
      driver: null,
      driverId: null,
      driverLatitude: null,
      driverLongitude: null,
      etaMinutes: null,
      pin: String(Math.floor(1000 + Math.random() * 9000)),
      rating: null,
      comment: '',
      issueReport: '',
      lostItemReport: '',
      couponCode: input.couponCode?.trim().toUpperCase() || '',
      rejectedDriverIds: []
    };
    this.saveTrips([trip, ...this.trips]);
    return trip;
  }

  updateTrip(id: string, patch: Partial<RideTrip>): RideTrip | null {
    const current = this.trips.find(trip => trip.id === id);
    if (!current) return null;
    const updated = { ...current, ...patch };
    this.saveTrips(this.trips.map(trip => trip.id === id ? updated : trip));
    return updated;
  }

  setDriverPresence(user: DemoUser, available: boolean, latitude = 2.9273, longitude = -75.2819): void {
    const presence: DriverPresence = {
      driverId: user.id,
      available,
      latitude,
      longitude,
      updatedAt: new Date().toISOString()
    };
    const next = [...this.presenceSubject.value.filter(item => item.driverId !== user.id), presence];
    this.write(PRESENCE_KEY, next);
    this.presenceSubject.next(next);
  }

  availableDrivers(): { user: DemoUser; presence: DriverPresence }[] {
    return this.presenceSubject.value.filter(item => item.available).flatMap(presence => {
      const user = this.auth.getDrivers().find(driver => driver.id === presence.driverId && driver.approval_status === 'approved');
      return user ? [{ user, presence }] : [];
    });
  }

  driversForMap(): { user: DemoUser; presence: DriverPresence }[] {
    return this.presenceSubject.value.flatMap(presence => {
      const user = this.auth.getDrivers().find(driver => driver.id === presence.driverId && driver.approval_status === 'approved');
      return user ? [{ user, presence }] : [];
    });
  }

  getDriverPresence(driverId: number): DriverPresence | null {
    return this.presenceSubject.value.find(item => item.driverId === driverId) || null;
  }

  availableDriverSnapshot(): DriverSnapshot | null {
    const available = this.availableDrivers()[0];
    if (!available) return null;
    const { user, presence } = available;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone || '300 000 0000 (demo)',
      rating: user.rating_average || 4.9,
      brand: user.brand || 'Renault',
      model: user.model || 'Logan',
      color: user.color || 'Gris',
      plate: user.plate || 'HGO-123',
      photoName: user.photo_name,
      latitude: presence.latitude,
      longitude: presence.longitude
    };
  }

  driverSnapshot(driverId: number): DriverSnapshot | null {
    const available = this.availableDrivers().find(item => item.user.id === driverId);
    if (!available) return null;
    const { user, presence } = available;
    return {
      id: user.id,
      name: user.name,
      phone: user.phone || '300 000 0000 (demo)',
      rating: user.rating_average || 4.9,
      brand: user.brand || 'Renault',
      model: user.model || 'Logan',
      color: user.color || 'Gris',
      plate: user.plate || 'HGO-123',
      photoName: user.photo_name,
      latitude: presence.latitude,
      longitude: presence.longitude
    };
  }

  getFavorites(clientId: number): RidePoint[] {
    return this.read<Record<number, RidePoint[]>>(FAVORITES_KEY, {})[clientId] || [];
  }

  saveFavorite(clientId: number, point: RidePoint): void {
    const allFavorites = this.read<Record<number, RidePoint[]>>(FAVORITES_KEY, {});
    const favorites = allFavorites[clientId] || [];
    if (!favorites.some(item => item.name.toLowerCase() === point.name.toLowerCase())) {
      allFavorites[clientId] = [...favorites, point];
      this.write(FAVORITES_KEY, allFavorites);
    }
  }

  getReportSummary(): { totalTrips: number; activeTrips: number; completedTrips: number; cancelledTrips: number; revenue: number; driverEarnings: number } {
    const completed = this.trips.filter(trip => trip.status === 'completed');
    return {
      totalTrips: this.trips.length,
      activeTrips: this.trips.filter(trip => ['searching', 'accepted', 'driver_arrived', 'in_progress'].includes(trip.status)).length,
      completedTrips: completed.length,
      cancelledTrips: this.trips.filter(trip => trip.status === 'cancelled').length,
      revenue: completed.reduce((sum, trip) => sum + (trip.finalFare ?? trip.quote.total), 0),
      driverEarnings: completed.reduce((sum, trip) => sum + trip.quote.driverEarnings, 0)
    };
  }

  formatCop(value: number): string {
    return `$${Math.round(value).toLocaleString('es-CO')} COP`;
  }

  paymentLabel(method: PaymentMethod): string {
    return PAYMENT_LABELS[method];
  }

  private saveTrips(trips: RideTrip[]): void {
    this.write(TRIPS_KEY, trips);
    this.tripsSubject.next(trips);
  }

  private read<T>(key: string, fallback: T): T {
    if (typeof localStorage === 'undefined') return fallback;
    const value = localStorage.getItem(key);
    if (!value) return fallback;
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }

  private write(key: string, value: unknown): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value));
  }
}
