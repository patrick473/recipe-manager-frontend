import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { IngredientDto } from '../../api/generated/model/ingredientDto';
import { RecipeStepDto } from '../../api/generated/model/recipeStepDto';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { ButtonDirective } from '../../shared/button.directive';
import { resolveImageUrl } from '../../shared/image-url.util';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { MarkdownEditorComponent } from '../../shared/markdown-editor/markdown-editor.component';
import { PropertiesPanelComponent } from '../../shared/properties-panel/properties-panel.component';
import { IngredientEditorComponent } from '../ingredient-editor/ingredient-editor.component';
import { StepEditorComponent } from '../step-editor/step-editor.component';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Shared create/edit form for recipes.
 *
 * - When reached via `/recipes/new` (no `:id` param) the form submits POST.
 * - When reached via `/recipes/:id/edit` the form pre-fills from the API and submits PUT.
 * - When reached via `/recipes/new` with `cloneFrom` in router navigation state (see
 *   `RecipeDetailComponent.cloneRecipe()`), the form pre-fills from that recipe (title
 *   suffixed " (Copy)") but still submits POST — `id`/`createdAt`/`updatedAt` are never copied.
 *
 * Validation rules (mirroring the backend):
 *   - `title`   — required, max 255 chars
 *   - `content` — required
 *
 * Uses Angular 22 block control-flow syntax (@if / @else).
 */
@Component({
  selector: 'app-recipe-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonDirective,
    LoaderComponent,
    MarkdownEditorComponent,
    PropertiesPanelComponent,
    IngredientEditorComponent,
    StepEditorComponent,
  ],
  templateUrl: './recipe-form.component.html',
  styleUrl: './recipe-form.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecipeFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly form: FormGroup<{
    title: FormControl<string>;
    description: FormControl<string>;
    content: FormControl<string>;
    ingredients: FormControl<IngredientDto[]>;
    steps: FormControl<RecipeStepDto[]>;
    tags: FormControl<string[]>;
    prepTimeMinutes: FormControl<number | null>;
    cookTimeMinutes: FormControl<number | null>;
    servings: FormControl<number | null>;
  }> = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    description: [''],
    content: [''],
    ingredients: this.fb.nonNullable.control<IngredientDto[]>([{ name: '' }]),
    steps: this.fb.nonNullable.control<RecipeStepDto[]>([{ instruction: '' }]),
    tags: this.fb.nonNullable.control<string[]>([]),
    prepTimeMinutes: this.fb.control<number | null>(null),
    cookTimeMinutes: this.fb.control<number | null>(null),
    servings: this.fb.control<number | null>(null),
  });

  protected readonly isEdit = signal(false);
  protected readonly recipe = signal<Recipe | null>(null);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly submitError = signal<string | null>(null);
  protected readonly tagSuggestions = signal<string[]>([]);
  protected readonly legacyRecipe = signal(false);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly imagePreviewUrl = signal<string | null>(null);
  protected readonly imageRemoved = signal(false);
  protected readonly imageError = signal<string | null>(null);

  // Tracks the object URL created via URL.createObjectURL() so it can be
  // revoked on re-selection/destroy. Never holds a resolveImageUrl() (server)
  // URL — those aren't ours to revoke.
  private createdObjectUrl: string | null = null;

  ngOnInit(): void {
    this.recipeService
      // size: 100 is the backend's max page size — the closest approximation
      // to "every tag currently in use" now that GET /recipes is paginated.
      .getAll({ size: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const allTags = response.content.flatMap((r) => r.tags ?? []);
          this.tagSuggestions.set([...new Set(allTags)].sort());
        },
        error: (err) => console.error(err),
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.loading.set(true);
      this.recipeService
        .getById(Number(id))
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (data) => {
            this.recipe.set(data);
            this.imagePreviewUrl.set(resolveImageUrl(data.imageUrl));
            this.form.patchValue({
              title: data.title,
              description: data.description ?? '',
              content: data.content ?? '',
              ingredients: data.ingredients,
              steps: data.steps,
              tags: data.tags ?? [],
              prepTimeMinutes: data.prepTimeMinutes ?? null,
              cookTimeMinutes: data.cookTimeMinutes ?? null,
              servings: data.servings ?? null,
            });
            this.legacyRecipe.set(data.ingredients.length === 0 && data.steps.length === 0 && !!data.content);
            this.loading.set(false);
          },
          error: (err) => {
            this.loadError.set(`Recipe #${id} could not be loaded.`);
            this.loading.set(false);
            console.error(err);
          },
        });
    } else {
      const cloneFrom = history.state?.cloneFrom as Recipe | undefined;
      if (cloneFrom) {
        this.form.patchValue({
          title: `${cloneFrom.title} (Copy)`,
          description: cloneFrom.description ?? '',
          content: cloneFrom.content ?? '',
          ingredients: cloneFrom.ingredients.map((ingredient) => ({ ...ingredient })),
          steps: cloneFrom.steps.map((step) => ({ ...step })),
          tags: cloneFrom.tags ?? [],
          prepTimeMinutes: cloneFrom.prepTimeMinutes ?? null,
          cookTimeMinutes: cloneFrom.cookTimeMinutes ?? null,
          servings: cloneFrom.servings ?? null,
        });
      }
    }
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const {
      title,
      description,
      content,
      ingredients,
      steps,
      tags,
      prepTimeMinutes,
      cookTimeMinutes,
      servings,
    } = this.form.getRawValue();
    const request = {
      title,
      description: description || null,
      content: content || null,
      ingredients,
      steps,
      tags,
      prepTimeMinutes,
      cookTimeMinutes,
      servings,
    };

    this.submitting.set(true);
    this.submitError.set(null);

    const currentRecipe = this.recipe();
    const wasEdit = this.isEdit() && !!currentRecipe;
    const save$ = wasEdit
      ? this.recipeService.update(currentRecipe.id, request)
      : this.recipeService.create(request);

    // Set once the JSON create/update succeeds, so the error handler can tell
    // "the recipe itself failed to save" apart from "the recipe saved fine,
    // but the follow-up image call failed" — the latter needs different
    // handling in create mode (see below).
    let savedRecipeId: number | null = null;

    save$
      .pipe(
        switchMap((saved) => {
          savedRecipeId = saved.id;
          const file = this.selectedFile();
          if (file) {
            return this.recipeService.uploadImage(saved.id, file);
          }
          if (this.imageRemoved()) {
            return this.recipeService.deleteImage(saved.id);
          }
          return of(saved);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (saved) => {
          this.router.navigate(['/recipes', saved.id]);
        },
        error: (err) => {
          if (!wasEdit && savedRecipeId !== null) {
            // Create mode: the JSON POST already succeeded, so the recipe
            // exists — only the follow-up image call failed. Retrying the
            // whole submit would create a duplicate recipe, so navigate to
            // the newly-created recipe instead of surfacing a blocking error.
            console.error(err);
            this.router.navigate(['/recipes', savedRecipeId], {
              state: { imageUploadFailed: true },
            });
            return;
          }
          if (err.status === 400 && err.error?.errors) {
            const msgs = Object.entries(err.error.errors)
              .map(([f, m]) => `${f}: ${m}`)
              .join('; ');
            this.submitError.set(`Validation failed — ${msgs}`);
          } else {
            this.submitError.set('Failed to save recipe. Please try again.');
          }
          this.submitting.set(false);
          console.error(err);
        },
      });
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.imageError.set('Please choose a JPEG, PNG, or WebP image.');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.imageError.set('Image must be 5MB or smaller.');
      input.value = '';
      return;
    }

    this.revokeCreatedObjectUrl();
    const objectUrl = URL.createObjectURL(file);
    this.createdObjectUrl = objectUrl;

    this.selectedFile.set(file);
    this.imagePreviewUrl.set(objectUrl);
    this.imageError.set(null);
    this.imageRemoved.set(false);
  }

  protected onRemoveImage(): void {
    this.revokeCreatedObjectUrl();
    this.selectedFile.set(null);
    this.imagePreviewUrl.set(null);
    this.imageRemoved.set(true);
  }

  ngOnDestroy(): void {
    this.revokeCreatedObjectUrl();
  }

  private revokeCreatedObjectUrl(): void {
    if (this.createdObjectUrl) {
      URL.revokeObjectURL(this.createdObjectUrl);
      this.createdObjectUrl = null;
    }
  }

  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  protected get titleError(): string {
    const ctrl = this.form.get('title');
    if (ctrl?.errors?.['required']) return 'Title is required.';
    if (ctrl?.errors?.['maxlength']) return 'Title must not exceed 255 characters.';
    return '';
  }
}
