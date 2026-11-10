import { Injectable } from '@angular/core';

export type UserRole = 'client' | 'driver' | 'admin';
export type DriverApproval = 'pending' | 'approved' | 'rejected';

export interface DemoUser {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  status: string;
  approval_status?: DriverApproval;
  license_number?: string;
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  identity_number?: string;
  photo_name?: string;
  license_file_name?: string;
  vehicle_document_name?: string;
  rating_average?: number;
  password?: string;
}

const USERS_KEY = 'ruta_demo_users';
const SESSION_KEY = 'ruta_demo_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  get currentUser(): DemoUser | null {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) as DemoUser : null;
  }

  login(role: UserRole, email: string, password: string): DemoUser {
    const account = this.users.find(user => user.role === role && user.email.toLowerCase() === email.trim().toLowerCase() && user.password === password);
    if (!account) throw new Error('Correo o contraseña incorrectos para este tipo de cuenta.');
    localStorage.setItem(SESSION_KEY, JSON.stringify(account));
    return account;
  }

  register(data: Omit<DemoUser, 'id' | 'status'> & { password: string }): DemoUser {
    if (this.users.some(user => user.email.toLowerCase() === data.email.trim().toLowerCase())) {
      throw new Error('Ya existe una cuenta con ese correo electrónico.');
    }
    if (data.role === 'admin') throw new Error('No se permite el registro público de administradores.');

    const account: DemoUser = {
      ...data,
      id: Date.now(),
      email: data.email.trim().toLowerCase(),
      status: data.role === 'driver' ? 'pending' : 'active',
      ...(data.role === 'driver' ? { approval_status: 'pending' as const } : {})
    };
    this.users = [...this.users, account];
    localStorage.setItem(SESSION_KEY, JSON.stringify(account));
    return account;
  }

  resetPassword(role: UserRole, email: string, newPassword: string): void {
    const users = this.users;
    const index = users.findIndex(user => user.role === role && user.email.toLowerCase() === email.trim().toLowerCase());
    if (index < 0) throw new Error('No encontramos una cuenta de ese tipo con ese correo.');
    users[index] = { ...users[index], password: newPassword };
    this.users = users;
  }

  logout(): void {
    localStorage.removeItem(SESSION_KEY);
  }

  getDrivers(): DemoUser[] {
    return this.users.filter(user => user.role === 'driver');
  }

  getClients(): DemoUser[] {
    return this.users.filter(user => user.role === 'client');
  }

  setDriverApproval(id: number, approval_status: DriverApproval): void {
    this.users = this.users.map(user => user.id === id ? {
      ...user,
      approval_status,
      status: approval_status === 'approved' ? 'active' : approval_status
    } : user);
  }

  demoCredentials(role: UserRole): { email: string; password: string } {
    if (role === 'admin') return { email: 'admin@rutaurbana.demo', password: 'Admin123!' };
    if (role === 'driver') return { email: 'conductor@rutaurbana.demo', password: 'Driver123!' };
    return { email: 'pasajero@rutaurbana.demo', password: 'Rider123!' };
  }

  private get users(): DemoUser[] {
    const stored = localStorage.getItem(USERS_KEY);
    if (stored) return JSON.parse(stored) as DemoUser[];
    const seeded: DemoUser[] = [
      { id: 1, name: 'Pasajero Demo', email: 'pasajero@rutaurbana.demo', phone: '3001234567', role: 'client', status: 'active', password: 'Rider123!' },
      { id: 2, name: 'Conductor Demo', email: 'conductor@rutaurbana.demo', phone: '3007654321', role: 'driver', status: 'active', approval_status: 'approved', rating_average: 4.9, license_number: 'CC-102030', identity_number: '102030', plate: 'RUT-123', brand: 'Renault', model: 'Logan', year: 2023, color: 'Gris', password: 'Driver123!' },
      { id: 3, name: 'Administración', email: 'admin@rutaurbana.demo', phone: '', role: 'admin', status: 'active', password: 'Admin123!' }
    ];
    this.users = seeded;
    return seeded;
  }

  private set users(users: DemoUser[]) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
}
