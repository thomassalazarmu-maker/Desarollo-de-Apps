import { AfterViewInit, ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, DemoUser, DriverApproval, UserRole } from '../auth.service';
import { MapRoutingService } from '../map-routing.service';
import { DriverPresence, FareCategory, FareSettings, PaymentMethod, RideQuote, RideTrip, TravelService, VehicleCategoryId } from '../travel.service';
import { Subscription } from 'rxjs';
import * as L from 'leaflet';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, AfterViewInit, OnDestroy {
  authView: 'select' | 'login' | 'register' | 'forgot' = 'select';
  selectedRole: UserRole = 'client';
  showPassword = false;
  showConfirmPassword = false;
  picking: 'origin' | 'destination' = 'origin';
  recovery = { email: '', new_password: '', confirm_password: '' };
  user: DemoUser | null = null;
  busy = false;
  message = '';
  isError = false;
  loginForm = { email: '', password: '' };
  registerForm: any = { name: '', email: '', phone: '', password: '', confirm_password: '', identity_number: '', license_number: '', plate: '', brand: '', model: '', year: new Date().getFullYear(), capacity: 4, color: '', photo_name: '', license_file_name: '', vehicle_document_name: '' };
  origin = { name: '', latitude: 2.9273, longitude: -75.2819 };
  destination = { name: '', latitude: 2.9357, longitude: -75.2863 };
  routeLoading = false;
  routeError = '';
  routeDistanceKm: number | null = null;
  routeDurationMin: number | null = null;
  routeGeometry: [number, number][] = [];
  routeQuotes: RideQuote[] = [];
  selectedCategoryId: VehicleCategoryId = 'economico';
  selectedPayment: PaymentMethod = 'cash';
  couponCode = '';
  scheduledAt = '';
  showSummary = false;
  tripComment = '';
  activeTrip: RideTrip | null = null;
  trips: RideTrip[] = [];
  requests: RideTrip[] = [];
  currentTrip: RideTrip | null = null;
  adminTrips: RideTrip[] = [];
  adminTripFilter: 'all' | 'active' | 'completed' | 'cancelled' = 'all';
  availableDrivers: { user: DemoUser; presence: DriverPresence }[] = [];
  fareSettings!: FareSettings;
  driverPin = '';
  issueText = '';
  lostItemText = '';
  favoritePlaces: { name: string; latitude: number; longitude: number }[] = [];
  adminStats: any = null;
  adminDrivers: any[] = [];
  availability = 'unavailable';
  private mapInitializing = false;
  private map?: L.Map;
  private originMarker?: L.Marker;
  private destinationMarker?: L.Marker;
  private driverMarker?: L.Marker;
  private routeLayer?: L.Polyline;
  private adminMap?: L.Map;
  private readonly adminDriverMarkers = new Map<number, L.Marker>();
  private tripsSubscription?: Subscription;
  private presenceSubscription?: Subscription;
  private faresSubscription?: Subscription;

  readonly auth = inject(AuthService);
  readonly travel = inject(TravelService);
  private readonly routing = inject(MapRoutingService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.user = this.auth.currentUser;
    this.fareSettings = this.travel.fareSettings;
    this.tripsSubscription = this.travel.trips$.subscribe(() => this.syncSharedState());
    this.presenceSubscription = this.travel.presence$.subscribe(() => {
      this.availableDrivers = this.travel.driversForMap();
      this.updateAdminDriverMarkers();
      this.changeDetector.detectChanges();
    });
    this.faresSubscription = this.travel.fares$.subscribe(settings => {
      this.fareSettings = settings;
      if (this.routeDistanceKm !== null && this.routeDurationMin !== null) this.refreshQuotes();
      this.changeDetector.detectChanges();
    });
    if (this.user?.role === 'client') this.favoritePlaces = this.travel.getFavorites(this.user.id);
    if (this.user) {
      void this.router.navigateByUrl(this.dashboardPath(this.user));
      void this.loadDashboard();
    }
  }

  ngAfterViewInit(): void {
    if (this.user?.role === 'client') this.initializeMap();
    if (this.user?.role === 'admin') this.initializeAdminMap();
  }

  ngOnDestroy(): void {
    this.tripsSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.faresSubscription?.unsubscribe();
    this.map?.remove();
    this.adminMap?.remove();
  }

  private syncSharedState(): void {
    if (!this.user) return;
    const allTrips = this.travel.trips;
    if (this.user.role === 'client') {
      this.trips = allTrips.filter(trip => trip.clientId === this.user!.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      this.activeTrip = this.trips.find(trip => !['completed', 'cancelled'].includes(trip.status)) || null;
      if (this.activeTrip) this.renderTripOnMap(this.activeTrip);
      else this.updateDriverMarker(null);
    } else if (this.user.role === 'driver') {
      this.requests = allTrips.filter(trip => trip.status === 'searching' && trip.driverId === null && !(trip.rejectedDriverIds || []).includes(this.user!.id));
      this.currentTrip = allTrips.find(trip => trip.driverId === this.user!.id && !['completed', 'cancelled'].includes(trip.status)) || null;
      const presence = this.travel.getDriverPresence(this.user.id);
      this.availability = presence?.available ? 'available' : 'unavailable';
    } else {
      this.adminTrips = allTrips;
      this.adminStats = this.travel.getReportSummary();
    }
    this.availableDrivers = this.travel.driversForMap();
    this.changeDetector.detectChanges();
  }

  chooseRole(role: UserRole): void {
    this.selectedRole = role;
    this.authView = 'login';
    this.loginForm = { email: '', password: '' };
    this.message = '';
    this.isError = false;
  }

  backToRoles(): void {
    this.authView = 'select';
    this.message = '';
    this.isError = false;
  }

  startRegistration(): void {
    if (this.selectedRole === 'admin') return;
    this.registerForm = { name: '', email: '', phone: '', password: '', confirm_password: '', identity_number: '', license_number: '', plate: '', brand: '', model: '', year: new Date().getFullYear(), capacity: 4, color: '', photo_name: '', license_file_name: '', vehicle_document_name: '' };
    this.authView = 'register';
    this.message = '';
  }

  handleFile(event: Event, field: 'photo_name' | 'license_file_name' | 'vehicle_document_name'): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.registerForm[field] = file.name;
  }

  googleDemo(): void {
    this.message = 'El acceso con Google es solo una demostración visual.';
    this.isError = false;
  }

  private initializeMap(): void {
    const mapElement = document.getElementById('ride-map');
    if (this.map || this.mapInitializing || !mapElement || (mapElement as HTMLElement & { _leaflet_id?: number })._leaflet_id) return;
    this.mapInitializing = true;
    this.map = L.map(mapElement, { zoomControl: false, attributionControl: true }).setView([2.9273, -75.2819], 13);
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
    if (this.routeGeometry.length) this.drawRoute(this.routeGeometry);
    if (this.activeTrip) this.renderTripOnMap(this.activeTrip);
    setTimeout(() => this.map?.invalidateSize(), 100);
    this.mapInitializing = false;
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
    this.routeQuotes = [];
    this.routeDistanceKm = null;
    this.routeDurationMin = null;
    this.routeGeometry = [];
    this.routeLayer?.remove();
    if (this.origin.name && this.destination.name) void this.calculateRoute();
  }

  private updateCoordinatesFromMarker(type: 'origin' | 'destination'): void {
    const marker = type === 'origin' ? this.originMarker : this.destinationMarker;
    if (marker) this.setPoint(type, marker.getLatLng());
  }

  private fitRideBounds(): void {
    if (!this.map) return;
    const sheetHeight = document.querySelector('.booking-sheet')?.getBoundingClientRect().height || 0;
    const bounds = this.routeGeometry.length
      ? this.routeGeometry.map(([longitude, latitude]) => [latitude, longitude] as [number, number])
      : [[this.origin.latitude, this.origin.longitude], [this.destination.latitude, this.destination.longitude]] as [number, number][];
    this.map.fitBounds(bounds, {
      paddingTopLeft: L.point(70, 125),
      paddingBottomRight: L.point(70, sheetHeight + 350),
      maxZoom: 14
    });
  }

  async findAddress(type: 'origin' | 'destination'): Promise<void> {
    const point = type === 'origin' ? this.origin : this.destination;
    if (!point.name.trim()) return;
    await this.run(async () => {
      const result = await this.routing.geocode(point.name);
      point.name = result.name;
      point.latitude = result.latitude;
      point.longitude = result.longitude;
      const coordinates = L.latLng(result.latitude, result.longitude);
      (type === 'origin' ? this.originMarker : this.destinationMarker)?.setLatLng(coordinates);
      this.map?.setView(coordinates, 16);
      if (this.origin.name && this.destination.name) await this.calculateRoute();
    });
  }

  private drawRoute(geometry: [number, number][]): void {
    if (!this.map || !geometry.length) return;
    this.routeLayer?.remove();
    const coordinates = geometry.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
    this.routeLayer = L.polyline(coordinates, { color: '#245c46', weight: 5, opacity: 0.85 }).addTo(this.map);
    this.fitRideBounds();
  }

  private renderTripOnMap(trip: RideTrip): void {
    if (!this.map) return;
    if (trip.routeGeometry.length) {
      this.routeGeometry = trip.routeGeometry;
      this.drawRoute(trip.routeGeometry);
    }
    if (trip.driverLatitude !== null && trip.driverLongitude !== null) {
      const position = L.latLng(trip.driverLatitude, trip.driverLongitude);
      if (!this.driverMarker) this.driverMarker = L.marker(position, { title: 'Conductor (ubicación demo)' }).addTo(this.map);
      else this.driverMarker.setLatLng(position);
    } else {
      this.updateDriverMarker(null);
    }
  }

  private updateDriverMarker(position: L.LatLng | null): void {
    if (!position) {
      this.driverMarker?.remove();
      this.driverMarker = undefined;
      return;
    }
    if (this.driverMarker) this.driverMarker.setLatLng(position);
    else if (this.map) this.driverMarker = L.marker(position, { title: 'Conductor disponible (demo)' }).addTo(this.map);
  }

  private initializeAdminMap(): void {
    const element = document.getElementById('admin-driver-map');
    if (this.adminMap || !element || (element as HTMLElement & { _leaflet_id?: number })._leaflet_id) return;
    this.adminMap = L.map(element, { zoomControl: true }).setView([2.9273, -75.2819], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(this.adminMap);
    this.updateAdminDriverMarkers();
    setTimeout(() => this.adminMap?.invalidateSize(), 100);
  }

  private updateAdminDriverMarkers(): void {
    if (!this.adminMap) return;
    const drivers = this.travel.driversForMap();
    const currentIds = new Set(drivers.map(item => item.user.id));
    for (const [id, marker] of this.adminDriverMarkers) {
      if (!currentIds.has(id)) {
        marker.remove();
        this.adminDriverMarkers.delete(id);
      }
    }
    for (const item of drivers) {
      const position = L.latLng(item.presence.latitude, item.presence.longitude);
      const label = `${item.user.name} · ${item.presence.available ? 'Disponible' : 'Desconectado'} (demo)`;
      const marker = this.adminDriverMarkers.get(item.user.id);
      if (marker) marker.setLatLng(position).setPopupContent(label);
      else this.adminDriverMarkers.set(item.user.id, L.marker(position).bindPopup(label).addTo(this.adminMap));
    }
  }

  async submitAuth(): Promise<void> {
    await this.run(async () => {
      const email = this.loginForm.email.trim();
      if (!this.isValidEmail(email)) throw new Error('Ingresa un correo electrónico válido.');
      this.user = this.auth.login(this.selectedRole, email, this.loginForm.password);
      this.authView = 'select';
      this.message = '';
      await this.router.navigateByUrl(this.dashboardPath(this.user));
      if (this.user.role === 'client') setTimeout(() => this.initializeMap(), 0);
      if (this.user.role === 'admin') setTimeout(() => this.initializeAdminMap(), 0);
      await this.loadDashboard();
    });
  }

  async submitRegistration(): Promise<void> {
    await this.run(async () => {
      if (!this.isValidEmail(this.registerForm.email)) throw new Error('Ingresa un correo electrónico válido.');
      if (this.registerForm.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      if (this.registerForm.password !== this.registerForm.confirm_password) throw new Error('Las contraseñas no coinciden.');
      if (this.selectedRole === 'driver' && (!this.registerForm.identity_number || !this.registerForm.license_number || !this.registerForm.plate || !this.registerForm.brand || !this.registerForm.model || !this.registerForm.year || !this.registerForm.color)) {
        throw new Error('Completa tus datos de identificación y los datos obligatorios del vehículo.');
      }
      const account = this.auth.register({ ...this.registerForm, role: this.selectedRole });
      if (account.role === 'driver') {
        this.user = account;
        await this.router.navigateByUrl('/home/driver/application');
        this.message = 'Solicitud guardada. Tu cuenta está pendiente de aprobación.';
      } else {
        this.user = account;
        await this.router.navigateByUrl('/home/passenger/dashboard');
        setTimeout(() => this.initializeMap(), 0);
        this.message = 'Cuenta creada correctamente.';
      }
      await this.loadDashboard();
    });
  }

  async resetPassword(): Promise<void> {
    await this.run(async () => {
      if (!this.isValidEmail(this.recovery.email)) throw new Error('Ingresa un correo electrónico válido.');
      if (this.recovery.new_password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
      if (this.recovery.new_password !== this.recovery.confirm_password) throw new Error('Las contraseñas no coinciden.');
      this.auth.resetPassword(this.selectedRole, this.recovery.email, this.recovery.new_password);
      this.authView = 'login';
      this.loginForm.email = this.recovery.email;
      this.loginForm.password = '';
      this.message = 'Contraseña actualizada en este dispositivo.';
      this.isError = false;
    });
  }

  async logout(): Promise<void> {
    this.auth.logout();
    this.user = null;
    this.message = 'Sesión cerrada.';
    this.map?.remove();
    this.map = undefined;
    this.mapInitializing = false;
    this.authView = 'select';
    await this.router.navigateByUrl('/home');
    window.location.reload();
  }

  async loadDashboard(): Promise<void> {
    this.syncSharedState();
    if (this.user?.role === 'admin') {
      await this.loadAdminDashboard();
      await this.loadAdminDrivers();
    }
  }

  async loadActive(): Promise<void> {
    this.syncSharedState();
  }

  async loadTrips(): Promise<void> {
    this.syncSharedState();
  }

  async estimateFare(): Promise<void> {
    await this.calculateRoute();
  }

  async calculateRoute(): Promise<void> {
    if (!this.origin.name.trim() || !this.destination.name.trim()) {
      this.routeError = 'Selecciona recogida y destino para calcular una ruta.';
      this.routeQuotes = [];
      return;
    }
    this.routeLoading = true;
    this.routeError = '';
    try {
      const route = await this.routing.route(this.origin, this.destination);
      this.routeDistanceKm = route.distanceKm;
      this.routeDurationMin = route.durationMinutes;
      this.routeGeometry = route.geometry;
      this.refreshQuotes();
      this.drawRoute(route.geometry);
      this.message = 'Distancia y duración calculadas desde una ruta por carretera.';
      this.isError = false;
    } catch (error: any) {
      this.routeDistanceKm = null;
      this.routeDurationMin = null;
      this.routeGeometry = [];
      this.routeQuotes = [];
      this.routeLayer?.remove();
      this.routeError = error?.message || 'No se pudo calcular la ruta. No mostraremos una tarifa sin distancia real.';
      this.isError = true;
    } finally {
      this.routeLoading = false;
      this.changeDetector.detectChanges();
    }
  }

  private refreshQuotes(): void {
    if (this.routeDistanceKm === null || this.routeDurationMin === null) return;
    this.fareSettings = this.travel.fareSettings;
    this.routeQuotes = this.fareSettings.categories.map(category => this.travel.quote(
      this.routeDistanceKm!, this.routeDurationMin!, category.id, this.couponCode
    ));
    if (!this.routeQuotes.some(quote => quote.categoryId === this.selectedCategoryId)) {
      this.selectedCategoryId = this.routeQuotes[0]?.categoryId || 'economico';
    }
  }

  get selectedQuote(): RideQuote | null {
    return this.routeQuotes.find(quote => quote.categoryId === this.selectedCategoryId) || null;
  }

  get filteredAdminTrips(): RideTrip[] {
    if (this.adminTripFilter === 'active') return this.adminTrips.filter(trip => ['searching', 'accepted', 'driver_arrived', 'in_progress'].includes(trip.status));
    if (this.adminTripFilter === 'completed' || this.adminTripFilter === 'cancelled') return this.adminTrips.filter(trip => trip.status === this.adminTripFilter);
    return this.adminTrips;
  }

  get driverTrips(): RideTrip[] {
    if (this.user?.role !== 'driver') return [];
    return this.travel.trips.filter(trip => trip.driverId === this.user!.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get driverEarnings(): number {
    return this.driverTrips.filter(trip => trip.status === 'completed').reduce((total, trip) => total + trip.quote.driverEarnings, 0);
  }

  selectCategory(categoryId: VehicleCategoryId): void {
    this.selectedCategoryId = categoryId;
  }

  applyCoupon(): void {
    const code = this.couponCode.trim().toUpperCase();
    if (code && !this.fareSettings.coupons[code]) {
      this.routeError = 'Ese cupón no está disponible.';
      return;
    }
    this.routeError = '';
    this.couponCode = code;
    this.refreshQuotes();
  }

  openRideSummary(): void {
    if (!this.routeQuotes.length || !this.selectedQuote) {
      this.routeError = 'Calcula una ruta por carretera antes de continuar.';
      return;
    }
    this.showSummary = true;
  }

  async requestRide(): Promise<void> {
    this.openRideSummary();
  }

  async confirmRide(): Promise<void> {
    if (!this.user || this.user.role !== 'client' || !this.selectedQuote || this.routeDistanceKm === null || this.routeDurationMin === null) return;
    if (this.scheduledAt && new Date(this.scheduledAt).getTime() <= Date.now()) {
      this.routeError = 'La hora programada debe ser posterior a la hora actual.';
      return;
    }
    this.travel.createTrip({
      client: this.user,
      origin: { ...this.origin },
      destination: { ...this.destination },
      distanceKm: this.routeDistanceKm,
      durationMin: this.routeDurationMin,
      routeGeometry: this.routeGeometry,
      categoryId: this.selectedCategoryId,
      paymentMethod: this.selectedPayment,
      couponCode: this.couponCode,
      scheduledAt: this.scheduledAt || null
    });
    this.showSummary = false;
    this.routeError = '';
    this.message = 'Buscando conductor disponible…';
  }

  async cancelRide(): Promise<void> {
    if (this.showSummary) {
      this.showSummary = false;
      return;
    }
    if (!this.activeTrip || this.activeTrip.status !== 'searching') return;
    this.travel.updateTrip(this.activeTrip.id, { status: 'cancelled' });
    this.message = 'Solicitud cancelada.';
  }

  async rateTrip(trip: RideTrip, score: number, comment = ''): Promise<void> {
    this.travel.updateTrip(trip.id, { rating: score, comment });
    this.message = 'Calificación guardada en el historial.';
  }

  async setAvailability(): Promise<void> {
    if (this.user?.role !== 'driver' || this.user.approval_status !== 'approved') return;
    const available = this.availability !== 'available';
    const current = this.travel.getDriverPresence(this.user.id);
    this.travel.setDriverPresence(this.user, available, current?.latitude ?? 2.9273, current?.longitude ?? -75.2819);
    this.availability = available ? 'available' : 'unavailable';
    this.message = available ? 'Conectado. Recibirás solicitudes compartidas.' : 'Te desconectaste.';
  }

  async loadRequests(): Promise<void> {
    this.syncSharedState();
  }

  async acceptRequest(id: string): Promise<void> {
    if (this.user?.role !== 'driver' || this.user.approval_status !== 'approved' || this.availability !== 'available') return;
    const request = this.requests.find(item => item.id === id);
    const driver = this.travel.driverSnapshot(this.user.id);
    if (!request || !driver) {
      this.message = 'Conéctate y publica tu ubicación demo para aceptar viajes.';
      return;
    }
    this.travel.updateTrip(id, {
      status: 'accepted',
      driverId: this.user.id,
      driver,
      driverLatitude: driver.latitude,
      driverLongitude: driver.longitude,
      etaMinutes: Math.max(3, Math.round(request.distanceKm * 2))
    });
    this.message = 'Viaje aceptado. El pasajero verá tu perfil y ubicación demo.';
  }

  rejectRequest(id: string): void {
    if (!this.user || this.user.role !== 'driver') return;
    const trip = this.requests.find(request => request.id === id);
    if (!trip) return;
    this.travel.updateTrip(id, { rejectedDriverIds: [...trip.rejectedDriverIds, this.user.id] });
    this.message = 'Solicitud descartada para tu cuenta.';
  }

  async driverAction(tripId: string, action: 'arrive' | 'start' | 'complete'): Promise<void> {
    if (this.user?.role !== 'driver' || this.user.approval_status !== 'approved' || this.currentTrip?.id !== tripId) return;
    const trip = this.currentTrip;
    if (action === 'start' && this.driverPin.trim() !== trip.pin) {
      this.message = 'PIN incorrecto. Pídele el código al pasajero antes de iniciar.';
      this.isError = true;
      return;
    }
    if (action === 'arrive') {
      this.travel.updateTrip(tripId, { status: 'driver_arrived', driverLatitude: trip.origin.latitude, driverLongitude: trip.origin.longitude });
      this.message = 'Llegada registrada.';
      return;
    }
    if (action === 'start') {
      this.travel.updateTrip(tripId, { status: 'in_progress', driverLatitude: trip.origin.latitude, driverLongitude: trip.origin.longitude });
      this.driverPin = '';
      this.message = 'Viaje iniciado con PIN válido.';
      return;
    }
    this.travel.updateTrip(tripId, { status: 'completed', finalFare: trip.quote.total, driverLatitude: trip.destination.latitude, driverLongitude: trip.destination.longitude });
    this.travel.setDriverPresence(this.user, true, trip.destination.latitude, trip.destination.longitude);
    this.message = 'Viaje finalizado. El pasajero puede calificarlo.';
  }

  async loadAdminDashboard(): Promise<void> {
    const report = this.travel.getReportSummary();
    const drivers = this.auth.getDrivers();
    this.adminStats = {
      ...report,
      total_clients: this.auth.getClients().length,
      total_drivers: drivers.length,
      pending_drivers: drivers.filter(driver => driver.approval_status === 'pending').length,
      approved_drivers: drivers.filter(driver => driver.approval_status === 'approved').length,
      available_drivers: this.travel.availableDrivers().length
    };
  }

  async loadAdminDrivers(): Promise<void> {
    this.adminDrivers = this.auth.getDrivers();
    this.changeDetector.detectChanges();
  }

  async approveDriver(driverId: number, status: DriverApproval = 'approved'): Promise<void> {
    this.auth.setDriverApproval(driverId, status);
    await this.loadAdminDrivers();
    await this.loadAdminDashboard();
    this.message = status === 'approved' ? 'Conductor aprobado en la demo.' : status === 'rejected' ? 'Solicitud de conductor rechazada.' : 'Solicitud marcada como pendiente.';
  }

  saveFareSettings(): void {
    this.travel.saveFareSettings(this.fareSettings);
    this.message = 'Tarifas guardadas. Se aplicarán a las siguientes cotizaciones.';
  }

  saveFavorite(type: 'origin' | 'destination'): void {
    if (!this.user || this.user.role !== 'client') return;
    const point = type === 'origin' ? this.origin : this.destination;
    if (!point.name.trim()) {
      this.message = 'Selecciona un punto antes de guardarlo.';
      return;
    }
    this.travel.saveFavorite(this.user.id, point);
    this.favoritePlaces = this.travel.getFavorites(this.user.id);
    this.message = 'Lugar guardado en favoritos.';
  }

  useFavorite(point: { name: string; latitude: number; longitude: number }, type: 'origin' | 'destination'): void {
    if (type === 'origin') this.origin = { ...point };
    else this.destination = { ...point };
    const marker = type === 'origin' ? this.originMarker : this.destinationMarker;
    marker?.setLatLng([point.latitude, point.longitude]);
    if (this.origin.name && this.destination.name) void this.calculateRoute();
  }

  async shareActiveTrip(): Promise<void> {
    if (!this.activeTrip) return;
    const shareText = `Huila Go: viaje ${this.activeTrip.id}. Ruta ${this.activeTrip.origin.name} a ${this.activeTrip.destination.name}.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Compartir viaje Huila Go', text: shareText });
      else if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
      this.message = 'Información del viaje lista para compartir.';
    } catch {
      this.message = shareText;
    }
  }

  reportSafety(): void {
    this.message = 'Alerta demo registrada. Si estás en peligro real, llama al 123.';
    this.isError = true;
  }

  submitIssue(trip: RideTrip | null = this.activeTrip, lostItem = false): void {
    if (!trip) return;
    const patch = lostItem ? { lostItemReport: this.lostItemText } : { issueReport: this.issueText };
    this.travel.updateTrip(trip.id, patch);
    this.issueText = '';
    this.lostItemText = '';
    this.message = lostItem ? 'Reporte de objeto perdido guardado.' : 'Reporte guardado para esta demostración.';
  }

  formatFare(value: number): string {
    return this.travel.formatCop(value);
  }

  paymentLabel(method: PaymentMethod): string {
    return this.travel.paymentLabel(method);
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }

  private dashboardPath(user: DemoUser): string {
    if (user.role === 'client') return '/home/passenger/dashboard';
    if (user.role === 'admin') return '/home/admin/dashboard';
    return user.approval_status === 'approved' ? '/home/driver/dashboard' : '/home/driver/application';
  }

  private distanceBetweenPoints(): number {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = radians(this.destination.latitude - this.origin.latitude);
    const longitudeDelta = radians(this.destination.longitude - this.origin.longitude);
    const value = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(this.origin.latitude)) * Math.cos(radians(this.destination.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
  }

  private demoRequests(): any[] {
    return [{
      id: 501,
      origin_name: 'Parque Santander, Neiva',
      destination_name: 'Centro Comercial San Pedro Plaza',
      estimated_distance_km: 2.3,
      estimated_fare: 7200,
      client: { name: 'Pasajero Demo' }
    }];
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy = true;
    this.message = '';
    this.isError = false;
    try { await action(); }
    catch (error: any) {
      this.isError = true;
      this.message = error?.message || 'No se pudo completar la operación.';
    } finally { this.busy = false; }
  }

}
