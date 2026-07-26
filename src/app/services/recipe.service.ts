import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { ListRecipesParams } from '../api/generated/model';
import { RecipesService } from '../api/generated/recipes/recipes.service';
import { Recipe, RecipePageResponse, RecipeRequest } from '../models/recipe.model';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';

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
  private readonly confirmService = inject(ConfirmDialogService);

  /** Reactive count of loaded recipes — updated after each getAll() call. */
  readonly recipeCount = signal<number>(0);

  /** True while a network request is in-flight. */
  readonly loading = signal<boolean>(false);

  /** Derived signal: whether there are any recipes loaded. */
  readonly hasRecipes = computed(() => this.recipeCount() > 0);

  /** GET /recipes — list recipes matching the given filter/sort/pagination params */
  getAll(params: ListRecipesParams): Observable<RecipePageResponse> {
    this.loading.set(true);
    return this.api.listRecipes(params).pipe(
      tap({
        next: (response) => {
          this.recipeCount.set(response.totalElements);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      }),
    );
  }

  /** GET /recipes/{id} — get a single recipe */
  getById(id: number): Observable<Recipe> {
    return this.api.getRecipe(id);
  }

  /** POST /recipes — create a new recipe */
  create(request: RecipeRequest): Observable<Recipe> {
    return this.api.createRecipe(request).pipe(tap(() => this.recipeCount.update((n) => n + 1)));
  }

  /** PUT /recipes/{id} — update an existing recipe */
  update(id: number, request: RecipeRequest): Observable<Recipe> {
    return this.api.updateRecipe(id, request);
  }

  /** DELETE /recipes/{id} — delete a recipe */
  delete(id: number): Observable<void> {
    return this.api
      .deleteRecipe(id)
      .pipe(tap(() => this.recipeCount.update((n) => Math.max(0, n - 1))));
  }

  /** POST /recipes/{id}/image — upload (or replace) a recipe's hero image */
  uploadImage(id: number, file: File): Observable<Recipe> {
    return this.api.uploadRecipeImage(id, { file });
  }

  /** DELETE /recipes/{id}/image — remove a recipe's hero image */
  deleteImage(id: number): Observable<Recipe> {
    return this.api.deleteRecipeImage(id);
  }

  /**
   * Shows a confirm dialog for deleting `recipe` and, if confirmed, performs
   * the delete. Invokes `onConfirmed` synchronously right after the user
   * confirms (before the HTTP call resolves) so callers can update local
   * "deleting" state at the same point in time as before this was extracted.
   *
   * Emits `false` if the user cancels (no HTTP call is made), or `true` once
   * the delete request completes successfully.
   */
  deleteWithConfirm(recipe: Recipe, onConfirmed?: () => void): Observable<boolean> {
    return this.confirmService
      .confirm({
        label: `Delete "${recipe.title}"?`,
        content: 'This cannot be undone.',
        yes: 'Delete',
        no: 'Cancel',
      })
      .pipe(
        switchMap((confirmed) => {
          if (!confirmed) return of(false);
          onConfirmed?.();
          return this.delete(recipe.id).pipe(map(() => true));
        }),
      );
  }
}
