# Especificación y Documentación Técnica de la API REST - Plataforma Uber

Documentación oficial y técnica de la API REST desarrollada en Laravel 12 con autenticación JSON Web Tokens (JWT) y persistencia en PostgreSQL 18, de conformidad con las especificaciones de los requerimientos
---

## 1. Información General

- **URL Base:** `http://IP_Servidor:8000/api`
- **Formato de Comunicación:** JSON (`Content-Type: application/json`, `Accept: application/json`)
- **Mecanismo de Autenticación:** JSON Web Tokens (JWT) mediante encabezado HTTP:
  ```http
  Authorization: Bearer <tu_jwt_token>
  ```
- **Control de Acceso por Roles (RBAC):**
  - `admin`: Acceso a monitoreo, aprobación de conductores, tarifas, métricas, incidencias y logs de auditoría.
  - `client`: Registro, solicitud de transporte, estimación de tarifas, seguimiento en tiempo real y calificaciones.
  - `driver`: Control de disponibilidad, recepción y aceptación de solicitudes (con bloqueo transaccional de concurrencia), ejecución del viaje (`arrive`, `start`, `complete`) y resumen de ingresos.

---

## 2. Códigos de Respuesta HTTP Estándar

| Código | Significado | Descripción |
|---|---|---|
| `200 OK` | Petición exitosa | La solicitud se procesó correctamente y retorna los datos solicitados. |
| `201 Created` | Recurso creado | El recurso (usuario, solicitud, viaje, calificación) se registró con éxito. |
| `400 Bad Request` | Regla de negocio infringida | Petición inválida (ej. solicitar un viaje cuando ya existe uno activo, o calificar un viaje no finalizado). |
| `401 Unauthorized` | No autenticado | Token JWT ausente, inválido o expirado. |
| `403 Forbidden` | Acceso denegado | El usuario no cuenta con el rol requerido o su cuenta está inactiva/suspendida. |
| `404 Not Found` | No encontrado | El registro o recurso especificado en la ruta no existe. |
| `409 Conflict` | Conflicto de concurrencia | Dos conductores intentaron aceptar el mismo servicio; la transacción con bloqueo atómico protegió el registro. |
| `422 Unprocessable Entity` | Error de validación | Los campos enviados no superaron las reglas de validación en Laravel. |

---

## 3. Catálogo de Endpoints

### 3.1. Módulo de Autenticación (`/api/auth`)

#### `POST /api/auth/register`
Registra un nuevo usuario en la plataforma como **Cliente** o como **Conductor** (incluyendo datos de licencia y vehículo).

- **Acceso:** Público
- **Cuerpo de la Petición (Cliente):**
  ```json
  {
    "name": "Daniela Morales",
    "email": "daniela@ejemplo.com",
    "phone": "3109876543",
    "password": "password123",
    "role": "client"
  }
  ```
- **Cuerpo de la Petición (Conductor):**
  ```json
  {
    "name": "Héctor Fabio",
    "email": "hector@ejemplo.com",
    "phone": "3154567890",
    "password": "password123",
    "role": "driver",
    "license_number": "LC-88291-CO",
    "plate": "HJK-987",
    "brand": "Mazda",
    "model": "Mazda 3",
    "year": 2024,
    "capacity": 4,
    "color": "Rojo Metálico"
  }
  ```
- **Respuesta Exitosa (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Usuario registrado exitosamente",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": 8,
      "name": "Daniela Morales",
      "email": "daniela@ejemplo.com",
      "phone": "3109876543",
      "role": "client",
      "status": "active"
    }
  }
  ```

---

#### `POST /api/auth/login`
Inicia sesión mediante correo electrónico o teléfono y contraseña, emitiendo un JWT firmado.

- **Acceso:** Público
- **Cuerpo de la Petición:**
  ```json
  {
    "login": "cliente@uber.com",
    "password": "cliente123"
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Inicio de sesión exitoso",
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "expires_in": 3600,
    "user": {
      "id": 2,
      "name": "Juan Pérez",
      "email": "cliente@uber.com",
      "role": "client",
      "status": "active"
    }
  }
  ```

---

#### `GET /api/auth/me`
Retorna el perfil del usuario autenticado a partir del token JWT.

- **Acceso:** Autenticado (`Bearer Token`)
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "user": {
      "id": 2,
      "name": "Juan Pérez",
      "email": "cliente@uber.com",
      "phone": "3001234567",
      "role": "client",
      "status": "active"
    }
  }
  ```

---

#### `POST /api/auth/logout`
Cierra la sesión del usuario e invalida el token JWT activo en la lista negra.

- **Acceso:** Autenticado (`Bearer Token`)
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Sesión cerrada exitosamente"
  }
  ```

---

#### `POST /api/auth/forgot-password`
Restablece la contraseña de acceso (RF-CLI-03).

- **Acceso:** Público
- **Cuerpo de la Petición:**
  ```json
  {
    "email": "cliente@uber.com",
    "new_password": "nuevaClaveSegura123"
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Contraseña restablecida exitosamente. Ya puede iniciar sesión con su nueva clave."
  }
  ```

---

### 3.2. Módulo de Tarifas Públicas

#### `GET /api/fares/active`
Consulta la tarifa urbana activa configurada en la plataforma para cálculos en el cliente.

- **Acceso:** Público
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "fare": {
      "id": 1,
      "name": "Tarifa Estándar Urbana",
      "base_fare": 3800,
      "price_per_km": 1250,
      "price_per_minute": 250,
      "minimum_fare": 6500,
      "surge_multiplier": 1.0,
      "active": true
    }
  }
  ```

---

### 3.3. Módulo de Cliente (`/api/client`)

> Todos los endpoints de este módulo requieren `Authorization: Bearer <token>` con rol `client`.

#### `POST /api/client/estimate-fare`
Calcula la distancia geográfica (fórmula de Haversine), duración estimada y valor proyectado según la tarifa activa.

- **Cuerpo de la Petición:**
  ```json
  {
    "origin_latitude": 4.6766,
    "origin_longitude": -74.0483,
    "destination_latitude": 4.6664,
    "destination_longitude": -74.0536
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "estimate": {
      "distance_km": 1.28,
      "duration_min": 4,
      "estimated_fare": 6500,
      "currency": "COP",
      "fare_breakdown": {
        "base_fare": 3800,
        "price_per_km": 1250,
        "price_per_minute": 250,
        "minimum_fare": 6500,
        "surge_multiplier": 1
      }
    }
  }
  ```

---

#### `POST /api/client/ride-requests`
Crea y confirma una solicitud de viaje en el sistema. Aplica regla de negocio contra solicitudes duplicadas.

- **Cuerpo de la Petición:**
  ```json
  {
    "origin_name": "Parque de la 93, Calle 93A # 12-50",
    "origin_latitude": 4.6766,
    "origin_longitude": -74.0483,
    "destination_name": "Centro Comercial Andino, Carrera 11 # 82-71",
    "destination_latitude": 4.6664,
    "destination_longitude": -74.0536
  }
  ```
- **Respuesta Exitosa (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Solicitud de viaje creada exitosamente. Buscando conductores disponibles...",
    "ride_request": {
      "id": 2,
      "client_id": 2,
      "origin_name": "Parque de la 93, Calle 93A # 12-50",
      "origin_latitude": 4.6766,
      "origin_longitude": -74.0483,
      "destination_name": "Centro Comercial Andino, Carrera 11 # 82-71",
      "destination_latitude": 4.6664,
      "destination_longitude": -74.0536,
      "estimated_distance_km": 1.28,
      "estimated_duration_min": 4,
      "estimated_fare": 6500,
      "status": "requested",
      "created_at": "2026-10-20T21:25:34.000000Z"
    }
  }
  ```
- **Respuesta de Conflicto (`400 Bad Request`):**
  ```json
  {
    "success": false,
    "message": "Ya cuenta con una solicitud o viaje activo en curso.",
    "active_request_id": 2
  }
  ```

---

#### `GET /api/client/active`
Consulta el estado del viaje o solicitud activa del cliente, trayendo la ubicación GPS del conductor, vehículo y datos de contacto.

- **Respuesta con Viaje Asignado (`200 OK`):**
  ```json
  {
    "success": true,
    "has_active": true,
    "type": "trip",
    "data": {
      "id": 3,
      "status": "assigned",
      "estimated_fare": 6500,
      "driver": {
        "id": 1,
        "rating_average": 4.95,
        "user": { "name": "Carlos Rodríguez", "phone": "3119876543" },
        "latest_location": {
          "latitude": 4.60971,
          "longitude": -74.08175
        }
      },
      "vehicle": {
        "plate": "UBR-123",
        "brand": "Chevrolet",
        "model": "Onix Turbo",
        "color": "Gris Plata"
      }
    }
  }
  ```

---

#### `POST /api/client/cancel/{id}`
Cancela una solicitud pendiente o un viaje asignado antes de iniciar su recorrido.

- **Cuerpo de la Petición:**
  ```json
  {
    "reason": "Cambio de planes del usuario"
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Solicitud cancelada exitosamente"
  }
  ```

---

#### `GET /api/client/trips`
Consulta el historial paginado de viajes realizados por el cliente autenticado.

- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "trips": {
      "data": [
        {
          "id": 1,
          "final_fare": 9300,
          "status": "completed",
          "completed_at": "2026-10-20T19:00:00.000000Z",
          "driver": {
            "user": { "name": "Carlos Rodríguez" }
          },
          "vehicle": { "plate": "UBR-123" }
        }
      ]
    }
  }
  ```

---

#### `POST /api/client/trips/{id}/rating`
Registra la calificación (1 a 5 estrellas) de un viaje finalizado, con comentario y reporte opcional de incidencias. Recalcula automáticamente la calificación promedio del conductor en PostgreSQL.

- **Cuerpo de la Petición:**
  ```json
  {
    "score": 5,
    "comment": "Conducción impecable y vehículo muy limpio.",
    "has_incident": false
  }
  ```
- **Respuesta Exitosa (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Calificación enviada exitosamente. ¡Gracias por sus comentarios!",
    "rating": {
      "id": 2,
      "trip_id": 1,
      "score": 5,
      "comment": "Conducción impecable y vehículo muy limpio."
    }
  }
  ```

---

### 3.4. Módulo de Conductor (`/api/driver`)

> Requiere `Authorization: Bearer <token>` con rol `driver`. Las operaciones de viaje verifican adicionalmente el middleware `driver.approved`.

#### `PUT /api/driver/availability`
Alterna el estado del conductor entre `available` (en línea) y `unavailable` (desconectado).

- **Cuerpo de la Petición:**
  ```json
  {
    "status": "available"
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Disponibilidad cambiada a: available",
    "availability_status": "available"
  }
  ```
- **Error si no está aprobado (`403 Forbidden`):**
  ```json
  {
    "success": false,
    "message": "Solo conductores aprobados pueden activar su disponibilidad.",
    "approval_status": "pending"
  }
  ```

---

#### `GET /api/driver/ride-requests`
Consulta las solicitudes de transporte pendientes en espera de asignación.

- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "requests": [
      {
        "id": 2,
        "origin_name": "Parque de la 93",
        "destination_name": "Centro Comercial Andino",
        "estimated_distance_km": 1.28,
        "estimated_fare": 6500,
        "client": { "name": "Juan Pérez", "phone": "3001234567" }
      }
    ]
  }
  ```

---

#### `POST /api/driver/ride-requests/{id}/accept`
Acepta una solicitud de servicio. **Protección RNF-05 contra condiciones de carrera:** implementa `DB::transaction()` con `lockForUpdate()`. Si dos conductores intentan aceptar el mismo viaje a la vez, uno gana y el otro recibe `409 Conflict`.

- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Servicio aceptado exitosamente",
    "trip": {
      "id": 3,
      "request_id": 2,
      "client_id": 2,
      "driver_id": 1,
      "status": "assigned",
      "estimated_fare": 6500
    }
  }
  ```
- **Respuesta de Conflicto (`409 Conflict`):**
  ```json
  {
    "success": false,
    "message": "Lo sentimos, este servicio ya fue tomado por otro conductor o fue cancelado."
  }
  ```

---

#### `POST /api/driver/trips/{id}/arrive`
Registra la llegada del conductor al punto de recogida.

- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Llegada registrada. El cliente ha sido notificado.",
    "trip": {
      "id": 3,
      "status": "driver_arrived",
      "driver_arrived_at": "2026-10-20T21:26:30.000000Z"
    }
  }
  ```

---

#### `POST /api/driver/trips/{id}/start`
Inicia oficialmente el recorrido hacia el destino.

- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Viaje iniciado exitosamente",
    "trip": {
      "id": 3,
      "status": "in_progress",
      "started_at": "2026-10-20T21:27:00.000000Z"
    }
  }
  ```

---

#### `POST /api/driver/trips/{id}/complete`
Finaliza el viaje, liquida la tarifa definitiva y restablece la disponibilidad del conductor a `available`.

- **Cuerpo de la Petición:**
  ```json
  {
    "actual_distance_km": 1.45,
    "actual_duration_min": 6
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Viaje finalizado con éxito. Tarifa definitiva calculada.",
    "trip": {
      "id": 3,
      "status": "completed",
      "final_fare": 6500,
      "distance_travelled_km": 1.45,
      "duration_travelled_min": 6,
      "completed_at": "2026-10-20T21:33:00.000000Z"
    }
  }
  ```

---

#### `POST /api/driver/location`
Actualiza periódicamente la geolocalización GPS del conductor.

- **Cuerpo de la Petición:**
  ```json
  {
    "latitude": 4.6715,
    "longitude": -74.0509,
    "heading": 120.5,
    "speed": 34.2,
    "trip_id": 3
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "location": {
      "driver_id": 1,
      "latitude": 4.6715,
      "longitude": -74.0509,
      "recorded_at": "2026-10-20T21:28:10.000000Z"
    }
  }
  ```

---

### 3.5. Módulo de Administrador (`/api/admin`)

> Requiere `Authorization: Bearer <token>` con rol `admin`.

#### `GET /api/admin/dashboard`
Retorna los indicadores clave de rendimiento (KPIs) y estadísticas de demanda.

- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "stats": {
      "total_clients": 3,
      "total_drivers": 3,
      "pending_drivers": 1,
      "approved_drivers": 2,
      "active_trips": 0,
      "completed_trips": 2,
      "cancelled_trips": 0,
      "pending_requests": 0,
      "total_revenue": 15800
    },
    "recent_trips": [ ... ],
    "recent_incidents": [ ... ]
  }
  ```

---

#### `GET /api/admin/drivers`
Lista todos los conductores con sus vehículos y estados de aprobación.

- **Filtro Opcional:** `?approval_status=pending`
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "drivers": [
      {
        "id": 3,
        "license_number": "LC-11928-C",
        "approval_status": "pending",
        "rating_average": 5.0,
        "user": { "name": "Andrés Torres (Pendiente)", "email": "andres@uber.com" },
        "vehicles": [
          { "plate": "NEW-456", "brand": "Kia", "model": "Rio", "year": 2024 }
        ]
      }
    ]
  }
  ```

---

#### `PATCH /api/admin/drivers/{id}/approval`
Aprueba, suspende o rechaza a un conductor registrado.

- **Cuerpo de la Petición:**
  ```json
  {
    "approval_status": "approved",
    "admin_notes": "Documentación de SOAT y licencia verificada."
  }
  ```
- **Respuesta Exitosa (`200 OK`):**
  ```json
  {
    "success": true,
    "message": "Estado del conductor actualizado a: approved",
    "driver": {
      "id": 3,
      "approval_status": "approved"
    }
  }
  ```

---

#### `GET /api/admin/fares` & `POST /api/admin/fares`
Consulta y crea configuraciones de tarifas urbanas.

- **Cuerpo de la Petición para crear tarifa:**
  ```json
  {
    "name": "Tarifa Hora Pico",
    "base_fare": 4500,
    "price_per_km": 1500,
    "price_per_minute": 350,
    "minimum_fare": 8000,
    "surge_multiplier": 1.3,
    "active": true
  }
  ```
- **Respuesta Exitosa (`201 Created`):**
  ```json
  {
    "success": true,
    "message": "Tarifa configurada exitosamente",
    "fare": { ... }
  }
  ```

---

#### `GET /api/admin/trips`
Lista exhaustiva de todos los viajes registrados con filtros por estado, cliente o conductor.

- **Parámetros de consulta opcionales:** `?status=completed`, `?driver_id=1`, `?client_id=2`, `?date=2026-10-20`

---

#### `GET /api/admin/reports`
Genera el reporte consolidado de cancelaciones, ingresos y desempeño de conductores.

---

#### `GET /api/admin/audit-logs`
Consulta el registro cronológico de acciones administrativas y de seguridad (RF-ADM-15).

---

## 4. Ejemplos de Peticiones con cURL

### Inicio de Sesión
```bash
curl -X POST http://127.0.0.1:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"login":"cliente@uber.com","password":"cliente123"}'
```

### Estimación de Tarifa
```bash
curl -X POST http://127.0.0.1:8000/api/client/estimate-fare \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN_OBTENIDO>" \
  -d '{
    "origin_latitude": 4.6766,
    "origin_longitude": -74.0483,
    "destination_latitude": 4.6664,
    "destination_longitude": -74.0536
  }'
```

### Dashboard de Administrador
```bash
curl -X GET http://127.0.0.1:8000/api/admin/dashboard \
  -H "Accept: application/json" \
  -H "Authorization: Bearer <TOKEN_ADMIN>"
```
