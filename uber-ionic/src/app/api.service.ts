import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly tokenKey = 'uber_access_token';
  private readonly userKey = 'uber_user';

  private readonly http = inject(HttpClient);

  get token(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  get user(): any | null {
    const stored = localStorage.getItem(this.userKey);
    return stored ? JSON.parse(stored) : null;
  }

  saveSession(response: any): void {
    if (response?.access_token) {
      localStorage.setItem(this.tokenKey, response.access_token);
    }
    if (response?.user) {
      localStorage.setItem(this.userKey, JSON.stringify(response.user));
    }
  }

  clearSession(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  request<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    let headers = new HttpHeaders({ Accept: 'application/json' });
    if (body !== undefined) headers = headers.set('Content-Type', 'application/json');
    if (this.token) headers = headers.set('Authorization', `Bearer ${this.token}`);

    return firstValueFrom(this.http.request<T>(method, `${environment.apiUrl}${path}`, {
      body,
      headers
    }));
  }
}