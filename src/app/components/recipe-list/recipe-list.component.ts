import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoaderComponent } from '../../shared/loader/loader.component';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_STORAGE_KEY = 'recipeListViewMode';

function initialViewMode(): ViewMode {
  const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
  return stored === 'list' ? 'list' : 'grid';
}

/**
 * Displays a card grid of all recipes. Each card links to the detail view.
 * Provides per-card delete (via a confirm dialog) with optimistic
 * removal from the list.
 *
 * Uses Angular 22 block control-flow (@if / @for / @empty).
 */
@Component({
  selector: 'app-recipe-list',
  imports: [RouterLink, DatePipe, ButtonDirective, IconComponent, LoaderComponent],
  templateUrl: './recipe-list.component.html',
  styleUrl: './recipe-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeListComponent implements OnInit {
  private readonly recipeService = inject(RecipeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly recipes = signal<Recipe[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal<number | null>(null);
  protected readonly viewMode = signal<ViewMode>(initialViewMode());

  ngOnInit(): void {
    this.loadRecipes();
  }

  private loadRecipes(): void {
    this.loading.set(true);
    this.error.set(null);
    this.recipeService
      .getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.recipes.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load recipes. Is the backend running?');
          this.loading.set(false);
          console.error(err);
        },
      });
  }

  protected setViewMode(mode: ViewMode): void {
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
  }

  protected deleteRecipe(recipe: Recipe): void {
    this.recipeService
      .deleteWithConfirm(recipe, () => this.deleting.set(recipe.id))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deleted) => {
          this.deleting.set(null);
          if (deleted) {
            this.recipes.update((recipes) => recipes.filter((r) => r.id !== recipe.id));
          }
        },
        error: (err) => {
          this.error.set(`Failed to delete "${recipe.title}".`);
          this.deleting.set(null);
          console.error(err);
        },
      });
  }
}
