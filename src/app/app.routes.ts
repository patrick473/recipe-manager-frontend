import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'recipes',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./components/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'recipes',
    loadComponent: () =>
      import('./components/recipe-list/recipe-list.component').then((m) => m.RecipeListComponent),
  },
  {
    path: 'recipes/new',
    loadComponent: () =>
      import('./components/recipe-form/recipe-form.component').then((m) => m.RecipeFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'recipes/:id',
    loadComponent: () =>
      import('./components/recipe-detail/recipe-detail.component').then(
        (m) => m.RecipeDetailComponent,
      ),
  },
  {
    path: 'recipes/:id/edit',
    loadComponent: () =>
      import('./components/recipe-form/recipe-form.component').then((m) => m.RecipeFormComponent),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () => import('./components/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: '**',
    redirectTo: 'recipes',
  },
];
