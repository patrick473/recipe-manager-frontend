import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { marked } from 'marked';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { resolveImageUrl } from '../../shared/image-url.util';
import {
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

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

  protected readonly canScale = computed(() =>
    hasScalableIngredients(this.recipe()?.content ?? ''),
  );

  /** Rounded target servings shown/edited by the servings stepper; null when the recipe has no stored servings. */
  protected readonly targetServings = computed(() => {
    const servings = this.recipe()?.servings;
    return servings ? Math.round(servings * this.scaleFactor()) : null;
  });

  protected readonly renderedContent = computed<SafeHtml>(() => {
    const recipe = this.recipe();
    if (!recipe) return '';

    const scaledContent = scaleIngredientsMarkdown(recipe.content, this.scaleFactor());
    const html = marked.parse(scaledContent) as string;
    return this.sanitizer.bypassSecurityTrustHtml(html);
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
