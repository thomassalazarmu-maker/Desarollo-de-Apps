import { Injectable } from '@angular/core';
import { RidePoint } from './travel.service';

export interface RoadRoute {
  distanceKm: number;
  durationMinutes: number;
  geometry: [number, number][];
}

@Injectable({ providedIn: 'root' })
export class MapRoutingService {
  async geocode(address: string): Promise<RidePoint> {
    const query = encodeURIComponent(`${address}, Neiva, Huila, Colombia`);
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=es&q=${query}`);
    if (!response.ok) throw new Error('No se pudo buscar la dirección. Revisa tu conexión a internet.');
    const results = await response.json();
    if (!results.length) throw new Error('No encontramos esa dirección en Neiva. Prueba otro nombre o elige el punto en el mapa.');
    return {
      name: results[0].display_name.split(',').slice(0, 3).join(',').trim(),
      latitude: Number(results[0].lat),
      longitude: Number(results[0].lon)
    };
  }

  async route(origin: RidePoint, destination: RidePoint): Promise<RoadRoute> {
    const coordinates = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`);
    if (!response.ok) throw new Error('No se pudo calcular la ruta por carretera. Inténtalo de nuevo más tarde.');
    const result = await response.json();
    const route = result.routes?.[0];
    if (result.code !== 'Ok' || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
      throw new Error('No hay una ruta por carretera disponible entre esos puntos. Ajusta el origen o destino.');
    }
    return {
      distanceKm: route.distance / 1000,
      durationMinutes: route.duration / 60,
      geometry: route.geometry.coordinates as [number, number][]
    };
  }
}
