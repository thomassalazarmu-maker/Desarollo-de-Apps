import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from './auth.service';

export const roleGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser;
  const expectedRole = route.data['role'] as UserRole | undefined;

  const approvalRequired = route.data['requireApproval'] === true;
  if (user && user.role === expectedRole && (!approvalRequired || user.role !== 'driver' || user.approval_status === 'approved')) {
    return true;
  }

  return router.parseUrl('/home');
};
