import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { IngredientDto } from '../../api/generated/model/ingredientDto';
import { Recipe } from '../../models/recipe.model';
import { AuthService } from '../../services/auth.service';
import { FavoritesService } from '../../services/favorites.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { RecipeService } from '../../services/recipe.service';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { resolveImageUrl } from '../../shared/image-url.util';
import {
  formatScaledQuantity,
  hasScalableIngredients,
  scaleIngredientsMarkdown,
} from '../../shared/ingredient-scaling.util';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { PropertiesPanelComponent } from '../../shared/properties-panel/properties-panel.component';
import { totalTimeMinutes } from '../../shared/recipe-time.util';

const MULTIPLIER_OPTIONS = [0.5, 1, 1.5, 2, 3];

/**
 * Shows a single recipe with:
 *   - title, optional description, and creation / update timestamps
 *   - Markdown content rendered to sanitised HTML
 *   - Edit, Clone, and Delete action buttons
 *
 * Uses Angular 22 block control-flow syntax (@if / @else).
 */
@Component({
  selector: 'app-recipe-detail',
  imports: [
    RouterLink,
    DatePipe,
    ButtonDirective,
    IconComponent,
    LoaderComponent,
    PropertiesPanelComponent,
  ],
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly recentlyViewedService = inject(RecentlyViewedService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly favoritesService = inject(FavoritesService);
  protected readonly auth = inject(AuthService);

  protected readonly propertiesPanel = viewChild(PropertiesPanelComponent);

  protected readonly recipe = signal<Recipe | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);

  // Not persisted — resets to 1 whenever a different recipe loads. See
  // INGREDIENT_SCALING_SPEC.md for why this stays view-only state.
  protected readonly scaleFactor = signal(1);
  protected readonly multiplierOptions = MULTIPLIER_OPTIONS;

  // Set by RecipeFormComponent's create-mode navigation when the recipe was
  // created successfully but the follow-up image upload failed — surfaced
  // here (rather than as a submitError on the form) because the form already
  // navigated away by the time this is known.
  protected readonly imageUploadFailed = signal(!!history.state?.imageUploadFailed);

  protected readonly totalTimeMinutes = totalTimeMinutes;
  protected readonly resolveImageUrl = resolveImageUrl;

  protected readonly hasStructuredContent = computed(() => {
    const recipe = this.recipe();
    return !!recipe && (recipe.ingredients.length > 0 || recipe.steps.length > 0);
  });

  protected readonly canScale = computed(() => {
    const recipe = this.recipe();
    return !!recipe && (recipe.ingredients.some((ingredient) => ingredient.quantity != null) ||
      hasScalableIngredients(recipe.content ?? ''));
  });

  /** Rounded target servings shown/edited by the servings stepper; null when the recipe has no stored servings. */
  protected readonly targetServings = computed(() => {
    const servings = this.recipe()?.servings;
    return servings ? Math.round(servings * this.scaleFactor()) : null;
  });

  protected readonly renderedNotes = computed<SafeHtml>(() => {
    const recipe = this.recipe();
    if (!recipe) return '';

    const content = this.hasStructuredContent()
      ? recipe.content ?? ''
      : scaleIngredientsMarkdown(recipe.content ?? '', this.scaleFactor());
    const html = marked.parse(content) as string;
    const clean = DOMPurify.sanitize(html);
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.recipeService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.recipe.set(data);
          this.scaleFactor.set(1);
          this.recentlyViewedService.record(data.id);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(
            err.status === 404 ? `Recipe #${id} was not found.` : 'Failed to load recipe.',
          );
          this.loading.set(false);
          console.error(err);
        },
      });
  }

  protected onServingsTargetChange(target: number): void {
    const recipe = this.recipe();
    if (!recipe?.servings || target < 1) return;

    this.scaleFactor.set(target / recipe.servings);
  }

  protected onMultiplierSelect(factor: number): void {
    this.scaleFactor.set(factor);
  }

  protected formatIngredient(ingredient: IngredientDto): string {
    const factor = this.scaleFactor();
    const quantity = ingredient.quantity == null
      ? ''
      : formatScaledQuantity(ingredient.quantity * factor, false);
    const quantityMax = ingredient.quantityMax == null
      ? ''
      : `–${formatScaledQuantity(ingredient.quantityMax * factor, false)}`;
    return [quantity + quantityMax, ingredient.unit, ingredient.name, ingredient.note]
      .filter(Boolean)
      .join(' ');
  }

  protected printRecipe(): void {
    this.propertiesPanel()?.expand();
    // Let Angular flush the (OnPush) DOM update for the now-expanded
    // properties body before the browser snapshots the page to print —
    // signal writes don't repaint synchronously within this handler.
    setTimeout(() => window.print());
  }

  protected cloneRecipe(): void {
    const recipe = this.recipe();
    if (!recipe) return;

    this.router.navigate(['/recipes/new'], { state: { cloneFrom: recipe } });
  }

  protected deleteRecipe(): void {
    const recipe = this.recipe();
    if (!recipe) return;

    this.recipeService
      .deleteWithConfirm(recipe, () => this.deleting.set(true))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (deleted) => {
          if (deleted) {
            this.favoritesService.remove(recipe.id);
            this.recentlyViewedService.remove(recipe.id);
            this.router.navigate(['/recipes']);
          } else {
            this.deleting.set(false);
          }
        },
        error: (err) => {
          this.error.set('Failed to delete recipe.');
          this.deleting.set(false);
          console.error(err);
        },
      });
  }
}
