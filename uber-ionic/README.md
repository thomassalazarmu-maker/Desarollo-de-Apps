# Ruta Urbana - Ionic Angular

Frontend Ionic Angular para la API descrita en `../API_DOCUMENTATION.md`.

## Ejecutar en desarrollo

```powershell
cd frontend
npm install
npm start
```

Abre `http://localhost:4200`. La URL base de la API está configurada en `src/environments/environment.ts` como `http://20.20.1.157:8000/api`.

## Conexión desde teléfono

El teléfono debe poder alcanzar la IP del servidor, normalmente estando en la misma red. El backend debe escuchar conexiones de red (no solamente `127.0.0.1`), permitir el puerto `8000` en el firewall y habilitar CORS para el origen del frontend (`http://localhost:4200` en desarrollo). Si se publica con HTTPS, la API también debe usar HTTPS; los navegadores bloquean peticiones HTTP desde una página HTTPS.

## Funciones conectadas

- Autenticación, registro de cliente/conductor, recuperación de contraseña y sesión JWT.
- Cliente: estimar tarifa, solicitar/cancelar viaje, consultar servicio activo e historial y calificar viajes.
- Conductor: disponibilidad, solicitudes pendientes, aceptar servicio y marcar llegada, inicio y finalización.
- Administrador: indicadores y aprobación de conductores.

La documentación no define un endpoint de streaming/notificaciones para seguimiento en tiempo real ni un proveedor de mapas. La ubicación se muestra solo si viene en la respuesta de viaje activo; para navegación/selección visual de lugares hace falta integrar un proveedor de mapas y completar el contrato del backend. El servicio de finalización recibe distancia y duración ingresadas por el conductor, tal como pide la API.

La pantalla de reserva usa Leaflet con cartografía de OpenStreetMap. Se puede seleccionar origen/destino tocando el mapa o arrastrando los marcadores; al escribir una dirección intenta ubicarla usando Nominatim.

## Compilar

```powershell
npm run build
```