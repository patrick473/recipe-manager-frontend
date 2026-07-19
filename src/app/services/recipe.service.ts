import { Injectable, signal, computed, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { RecipesService } from '../api/generated/recipes/recipes.service';
import { Recipe, RecipeRequest } from '../models/recipe.model';

/**
 * Service that wraps the Orval-generated Recipe Manager API client.
 *
 * Uses Angular signals to expose reactive state (loading indicator and
 * total recipe count) so consuming components can use signal-based
 * reactivity with OnPush change detection.
 *
 * Inject this service into components that need to read or modify recipes.
 * Every method returns an Observable; subscribe (or use the async pipe) in
 * the component.
 */
@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly api = inject(RecipesService);

  /** Reactive count of loaded recipes — updated after each getAll() call. */
  readonly recipeCount = signal<number>(0);

  /** True while a network request is in-flight. */
  readonly loading = signal<boolean>(false);

  /** Derived signal: whether there are any recipes loaded. */
  readonly hasRecipes = computed(() => this.recipeCount() > 0);

  /** GET /recipes — list all recipes */
  getAll(): Observable<Recipe[]> {
    this.loading.set(true);
    return this.api.listRecipes().pipe(
      tap({
        next: (recipes) => {
          this.recipeCount.set(recipes.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      })
    );
  }

  /** GET /recipes/{id} — get a single recipe */
  getById(id: number): Observable<Recipe> {
    return this.api.getRecipe(id);
  }

  /** POST /recipes — create a new recipe */
  create(request: RecipeRequest): Observable<Recipe> {
    return this.api.createRecipe(request).pipe(
      tap(() => this.recipeCount.update((n) => n + 1))
    );
  }

  /** PUT /recipes/{id} — update an existing recipe */
  update(id: number, request: RecipeRequest): Observable<Recipe> {
    return this.api.updateRecipe(id, request);
  }

  /** DELETE /recipes/{id} — delete a recipe */
  delete(id: number): Observable<void> {
    return this.api.deleteRecipe(id).pipe(
      tap(() => this.recipeCount.update((n) => Math.max(0, n - 1)))
    );
  }
}
