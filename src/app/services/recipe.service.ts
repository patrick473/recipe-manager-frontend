import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Recipe, RecipeRequest } from '../models/recipe.model';
import { environment } from '../../environments/environment';

/**
 * Service that wraps all five Recipe Manager API endpoints.
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
  private readonly apiUrl = `${environment.apiUrl}/recipes`;

  /** Reactive count of loaded recipes — updated after each getAll() call. */
  readonly recipeCount = signal<number>(0);

  /** True while a network request is in-flight. */
  readonly loading = signal<boolean>(false);

  /** Derived signal: whether there are any recipes loaded. */
  readonly hasRecipes = computed(() => this.recipeCount() > 0);

  constructor(private http: HttpClient) {}

  /** GET /recipes — list all recipes */
  getAll(): Observable<Recipe[]> {
    this.loading.set(true);
    return this.http.get<Recipe[]>(this.apiUrl).pipe(
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
    return this.http.get<Recipe>(`${this.apiUrl}/${id}`);
  }

  /** POST /recipes — create a new recipe */
  create(request: RecipeRequest): Observable<Recipe> {
    return this.http.post<Recipe>(this.apiUrl, request).pipe(
      tap(() => this.recipeCount.update((n) => n + 1))
    );
  }

  /** PUT /recipes/{id} — update an existing recipe */
  update(id: number, request: RecipeRequest): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.apiUrl}/${id}`, request);
  }

  /** DELETE /recipes/{id} — delete a recipe */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => this.recipeCount.update((n) => Math.max(0, n - 1)))
    );
  }
}
