import { Route } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { authGuard } from './guards/auth.guard';
import { routes } from './app.routes';
import { LoginComponent } from './components/login/login.component';
import { RegisterComponent } from './components/register/register.component';
import { RecipeListComponent } from './components/recipe-list/recipe-list.component';
import { RecipeFormComponent } from './components/recipe-form/recipe-form.component';
import { RecipeDetailComponent } from './components/recipe-detail/recipe-detail.component';

function findRoute(path: string): Route {
  const route = routes.find((r) => r.path === path);
  if (!route) throw new Error(`No route registered for path "${path}"`);
  return route;
}

async function loadComponent(route: Route): Promise<unknown> {
  const loaded = await route.loadComponent!();
  return 'default' in loaded ? loaded.default : loaded;
}

describe('routes', () => {
  it('redirects the empty path to /recipes', () => {
    const route = findRoute('');
    expect(route.redirectTo).toBe('recipes');
    expect(route.pathMatch).toBe('full');
  });

  it('redirects unmatched paths to /recipes', () => {
    const route = findRoute('**');
    expect(route.redirectTo).toBe('recipes');
  });

  it('lazy-loads LoginComponent for /login', async () => {
    const route = findRoute('login');
    expect(await loadComponent(route)).toBe(LoginComponent);
  });

  it('lazy-loads RegisterComponent for /register', async () => {
    const route = findRoute('register');
    expect(await loadComponent(route)).toBe(RegisterComponent);
  });

  it('lazy-loads RecipeListComponent for /recipes', async () => {
    const route = findRoute('recipes');
    expect(await loadComponent(route)).toBe(RecipeListComponent);
  });

  it('lazy-loads RecipeFormComponent behind authGuard for /recipes/new', async () => {
    const route = findRoute('recipes/new');
    expect(route.canActivate).toEqual([authGuard]);
    expect(await loadComponent(route)).toBe(RecipeFormComponent);
  });

  it('lazy-loads RecipeDetailComponent for /recipes/:id', async () => {
    const route = findRoute('recipes/:id');
    expect(await loadComponent(route)).toBe(RecipeDetailComponent);
  });

  it('lazy-loads RecipeFormComponent behind authGuard for /recipes/:id/edit', async () => {
    const route = findRoute('recipes/:id/edit');
    expect(route.canActivate).toEqual([authGuard]);
    expect(await loadComponent(route)).toBe(RecipeFormComponent);
  });
});
