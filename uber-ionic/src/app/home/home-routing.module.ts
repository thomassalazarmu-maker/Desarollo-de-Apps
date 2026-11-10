import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomePage } from './home.page';
import { roleGuard } from '../role.guard';

const routes: Routes = [
  {
    path: '',
    component: HomePage,
  },
  {
    path: 'passenger/dashboard',
    component: HomePage,
    canActivate: [roleGuard],
    data: { role: 'client' },
  },
  {
    path: 'driver/dashboard',
    component: HomePage,
    canActivate: [roleGuard],
    data: { role: 'driver', requireApproval: true },
  },
  {
    path: 'driver/application',
    component: HomePage,
    canActivate: [roleGuard],
    data: { role: 'driver' },
  },
  {
    path: 'admin/dashboard',
    component: HomePage,
    canActivate: [roleGuard],
    data: { role: 'admin' },
  },
  { path: '**', redirectTo: '' },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HomePageRoutingModule {}
