# Huila Go - Ionic Angular

Frontend Ionic Angular para la plataforma de viajes. El acceso, registro, aprobación de conductores y datos de dashboards de esta entrega son simulados en el navegador; no se envían credenciales ni documentos a un backend.

## Ejecutar en desarrollo

```powershell
cd frontend
npm install
npm start
```

Abre `http://localhost:4200` y elige Pasajero, Conductor o Administrador.

## Cuentas demo

| Rol | Correo | Contraseña |
|---|---|---|
| Pasajero | `pasajero@rutaurbana.demo` | `Rider123!` |
| Conductor aprobado | `conductor@rutaurbana.demo` | `Driver123!` |
| Administrador | `admin@rutaurbana.demo` | `Admin123!` |

Los datos se guardan en `localStorage` del navegador. La recuperación de contraseña solo cambia la contraseña local. Las cargas del conductor guardan el nombre del archivo, no transfieren el documento. El login de Google es únicamente visual.

## Probar en teléfono

Inicia el servidor de desarrollo con `npm start -- --host 0.0.0.0` y abre desde el teléfono la dirección de red que muestre Ionic. El teléfono y el computador deben estar en la misma red Wi-Fi. El mapa y la búsqueda de direcciones necesitan conexión a internet; la autenticación y los dashboards funcionan localmente sin backend.

## Flujos de demostración

- Acceso por rol, registro de pasajero/conductor, recuperación local y sesión persistida.
- Pasajero: estimación, solicitud/cancelación y viajes de muestra.
- Conductor: solicitud pendiente, disponibilidad, aceptación y avance de viajes de muestra; el acceso a viajes requiere aprobación.
- Administrador: indicadores demo y aprobación/rechazo local de conductores.

La especificación de la API está en `../API_DOCUMENTATION.md`. El servicio HTTP y la URL de API se conservan para una futura integración; estos flujos demo no hacen peticiones a la API.

La pantalla de reserva usa Leaflet con cartografía de OpenStreetMap. Se puede seleccionar origen/destino tocando el mapa o arrastrando los marcadores; al escribir una dirección intenta ubicarla usando Nominatim.

## Compilar

```powershell
npm run build
```