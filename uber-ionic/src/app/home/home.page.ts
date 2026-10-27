import { AfterViewInit, Component, inject, OnInit } from '@angular/core';
import { ApiService } from '../api.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, AfterViewInit {
  mode: 'login' | 'register' = 'login';
  authOpen = false;
  picking: 'origin' | 'destination' = 'origin';
  showForgotPassword = false;
  recovery = { email: '', new_password: '' };
  user: any = null;
  busy = false;
  message = '';
  isError = false;
  loginForm = { login: '', password: '' };
  registerForm: any = { name: '', email: '', phone: '', password: '', role: 'client', license_number: '', plate: '', brand: '', model: '', year: new Date().getFullYear(), capacity: 4, color: '' };
  origin = { name: '', latitude: 4.6766, longitude: -74.0483 };
  destination = { name: '', latitude: 4.6664, longitude: -74.0536 };
  estimate: any = null;
  active: any = null;
  trips: any[] = [];
  requests: any[] = [];
  currentTrip: any = null;
  adminStats: any = null;
  adminDrivers: any[] = [];
  availability = 'unavailable';
  actualDistance = 0;
  actualDuration = 0;
  private map?: L.Map;
  private originMarker?: L.Marker;
  private destinationMarker?: L.Marker;

  private readonly api = inject(ApiService);

  ngOnInit(): void {
    this.user = this.api.user;
    if (this.user) void this.loadDashboard();
  }

  ngAfterViewInit(): void {
    if (!this.user || this.user.role === 'client') this.initializeMap();
  }

  private initializeMap(): void {
    if (this.map) return;
    this.map = L.map('ride-map', { zoomControl: false, attributionControl: true }).setView([4.6533, -74.0836], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    this.map.on('click', (event: L.LeafletMouseEvent) => this.setPoint(this.picking, event.latlng));
    this.originMarker = L.marker([this.origin.latitude, this.origin.longitude], {
      draggable: true,
      icon: this.createMarkerIcon('origin')
    }).addTo(this.map);
    this.destinationMarker = L.marker([this.destination.latitude, this.destination.longitude], {
      draggable: true,
      icon: this.createMarkerIcon('destination')
    }).addTo(this.map);
    this.originMarker.on('dragend', () => this.updateCoordinatesFromMarker('origin'));
    this.destinationMarker.on('dragend', () => this.updateCoordinatesFromMarker('destination'));
    this.fitRideBounds();
    setTimeout(() => this.map?.invalidateSize(), 100);
  }

  private createMarkerIcon(type: 'origin' | 'destination'): L.DivIcon {
    const markerClass = type === 'origin' ? 'map-pin map-pin-origin' : 'map-pin map-pin-destination';
    return L.divIcon({ className: 'map-marker-wrapper', html: `<span class="${markerClass}"></span>`, iconSize: [26, 26], iconAnchor: [13, 13] });
  }

  private setPoint(type: 'origin' | 'destination', coordinates: L.LatLng): void {
    const point = type === 'origin' ? this.origin : this.destination;
    point.latitude = Number(coordinates.lat.toFixed(6));
    point.longitude = Number(coordinates.lng.toFixed(6));
    if (type === 'origin') this.originMarker?.setLatLng(coordinates);
    else this.destinationMarker?.setLatLng(coordinates);
    if (!point.name || point.name.startsWith('Punto en el mapa')) {
      point.name = `Punto en el mapa (${point.latitude.toFixed(4)}, ${point.longitude.toFixed(4)})`;
    }
    this.estimate = null;
  }

  private updateCoordinatesFromMarker(type: 'origin' | 'destination'): void {
    const marker = type === 'origin' ? this.originMarker : this.destinationMarker;
    if (marker) this.setPoint(type, marker.getLatLng());
  }

  private fitRideBounds(): void {
    if (!this.map) return;
    const sheetHeight = document.querySelector('.booking-sheet')?.getBoundingClientRect().height || 0;
    this.map.fitBounds([
      [this.origin.latitude, this.origin.longitude],
      [this.destination.latitude, this.destination.longitude]
    ], {
      paddingTopLeft: L.point(70, 125),
      paddingBottomRight: L.point(70, sheetHeight + 350),
      maxZoom: 14
    });
  }

  async findAddress(type: 'origin' | 'destination'): Promise<void> {
    const point = type === 'origin' ? this.origin : this.destination;
    if (!point.name.trim()) return;
    await this.run(async () => {
      const query = encodeURIComponent(`${point.name}, Bogotá, Colombia`);
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${query}`);
      const results = await response.json();
      if (!results.length) throw new Error('No encontramos esa dirección. Prueba con otro nombre o elige el punto en el mapa.');
      const coordinates = L.latLng(Number(results[0].lat), Number(results[0].lon));
      this.setPoint(type, coordinates);
      this.map?.setView(coordinates, 16);
    });
  }

  openAuth(mode: 'login' | 'register' = 'login'): void {
    this.mode = mode;
    this.authOpen = true;
    this.showForgotPassword = false;
  }

  async submitAuth(): Promise<void> {
    this.run(async () => {
      const path = this.mode === 'login' ? '/auth/login' : '/auth/register';
      const payload = this.mode === 'login' ? this.loginForm : this.registerForm;
      const response = await this.api.request('POST', path, payload);
      this.api.saveSession(response);
      this.user = response.user;
      this.authOpen = false;
      if (this.user?.role !== 'client') {
        this.map?.remove();
        this.map = undefined;
      }
      this.message = response.message || 'Sesión iniciada.';
      await this.loadDashboard();
    });
  }

  continueToBooking(): void {
    this.mode = 'login';
    this.showForgotPassword = false;
    this.message = 'Inicia sesión o crea una cuenta para calcular la tarifa y solicitar el viaje.';
    this.isError = false;
  }

  async resetPassword(): Promise<void> {
    await this.run(async () => {
      const response = await this.api.request('POST', '/auth/forgot-password', this.recovery);
      this.message = response.message || 'Contraseña restablecida.';
      this.showForgotPassword = false;
      this.mode = 'login';
    });
  }

  async logout(): Promise<void> {
    try { await this.api.request('POST', '/auth/logout'); } catch { /* local session still needs clearing */ }
    this.api.clearSession();
    this.user = null;
    this.message = 'Sesión cerrada.';
    this.map?.remove();
    this.map = undefined;
    setTimeout(() => this.initializeMap(), 0);
  }

  async loadDashboard(): Promise<void> {
    if (!this.user) return;
    if (this.user.role === 'client') {
      await Promise.all([this.loadActive(), this.loadTrips()]);
    } else if (this.user.role === 'driver') {
      await this.loadRequests();
    } else if (this.user.role === 'admin') {
      await Promise.all([this.loadAdminDashboard(), this.loadAdminDrivers()]);
    }
  }

  async loadActive(): Promise<void> {
    const response = await this.api.request('GET', '/client/active');
    this.active = response.has_active ? response.data : null;
  }

  async loadTrips(): Promise<void> {
    const response = await this.api.request('GET', '/client/trips');
    this.trips = response.trips?.data || [];
  }

  async estimateFare(): Promise<void> {
    await this.run(async () => {
      if (!this.user) {
        this.openAuth();
        throw new Error('Inicia sesión para consultar la tarifa del viaje.');
      }
      const response = await this.api.request('POST', '/client/estimate-fare', {
        origin_latitude: Number(this.origin.latitude), origin_longitude: Number(this.origin.longitude),
        destination_latitude: Number(this.destination.latitude), destination_longitude: Number(this.destination.longitude)
      });
      this.estimate = response.estimate;
    });
  }

  async requestRide(): Promise<void> {
    await this.run(async () => {
      if (!this.user) {
        this.openAuth();
        throw new Error('Inicia sesión para solicitar el viaje.');
      }
      await this.api.request('POST', '/client/ride-requests', {
        origin_name: this.origin.name, origin_latitude: Number(this.origin.latitude), origin_longitude: Number(this.origin.longitude),
        destination_name: this.destination.name, destination_latitude: Number(this.destination.latitude), destination_longitude: Number(this.destination.longitude)
      });
      this.message = 'Solicitud enviada. Actualiza el estado para consultar cambios.';
      this.estimate = null;
      await this.loadActive();
    });
  }

  async cancelRide(): Promise<void> {
    if (!this.active?.id) return;
    await this.run(async () => {
      await this.api.request('POST', `/client/cancel/${this.active.id}`, { reason: 'Cancelado desde la app' });
      this.message = 'Viaje cancelado.';
      await this.loadActive();
    });
  }

  async rateTrip(trip: any, score: number): Promise<void> {
    await this.run(async () => {
      await this.api.request('POST', `/client/trips/${trip.id}/rating`, { score, comment: '', has_incident: false });
      this.message = 'Calificación enviada.';
      await this.loadTrips();
    });
  }

  async setAvailability(): Promise<void> {
    await this.run(async () => {
      const status = this.availability === 'available' ? 'unavailable' : 'available';
      const response = await this.api.request('PUT', '/driver/availability', { status });
      this.availability = response.availability_status;
      this.message = response.message;
    });
  }

  async loadRequests(): Promise<void> {
    const response = await this.api.request('GET', '/driver/ride-requests');
    this.requests = response.requests || [];
  }

  async acceptRequest(id: number): Promise<void> {
    await this.run(async () => {
      const response = await this.api.request('POST', `/driver/ride-requests/${id}/accept`);
      this.currentTrip = response.trip;
      this.message = 'Servicio aceptado.';
      await this.loadRequests();
    });
  }

  async driverAction(tripId: number, action: 'arrive' | 'start' | 'complete'): Promise<void> {
    await this.run(async () => {
      const body = action === 'complete' ? { actual_distance_km: Number(this.actualDistance), actual_duration_min: Number(this.actualDuration) } : undefined;
      const response = await this.api.request('POST', `/driver/trips/${tripId}/${action}`, body);
      this.currentTrip = response.trip || this.currentTrip;
      if (action === 'complete') this.currentTrip = null;
      this.message = action === 'complete' ? 'Viaje finalizado.' : 'Estado del viaje actualizado.';
      await this.loadRequests();
    });
  }

  async loadAdminDashboard(): Promise<void> {
    const response = await this.api.request('GET', '/admin/dashboard');
    this.adminStats = response.stats;
  }

  async loadAdminDrivers(): Promise<void> {
    const response = await this.api.request('GET', '/admin/drivers');
    this.adminDrivers = response.drivers || [];
  }

  async approveDriver(driverId: number): Promise<void> {
    await this.run(async () => {
      await this.api.request('PATCH', `/admin/drivers/${driverId}/approval`, { approval_status: 'approved', admin_notes: '' });
      this.message = 'Conductor aprobado.';
      await this.loadAdminDrivers();
    });
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.message = '';
    this.isError = false;
    try { await action(); }
    catch (error: any) {
      this.isError = true;
      this.message = error?.error?.message || error?.message || 'No se pudo completar la operación. Verifica la conexión con el backend.';
    } finally { this.busy = false; }
  }

}
