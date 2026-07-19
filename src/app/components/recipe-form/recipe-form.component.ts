import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TuiButton, TuiError, TuiLink, TuiLoader, TuiNotification, TuiTextfield } from '@taiga-ui/core';
import { TuiBreadcrumbs, TuiTextarea } from '@taiga-ui/kit';
import { TuiItem } from '@taiga-ui/cdk';
import { TuiCard } from '@taiga-ui/layout';
import { RecipeService } from '../../services/recipe.service';
import { Recipe } from '../../models/recipe.model';

/**
 * Shared create/edit form for recipes.
 *
 * - When reached via `/recipes/new` (no `:id` param) the form submits POST.
 * - When reached via `/recipes/:id/edit` the form pre-fills from the API and submits PUT.
 *
 * Validation rules (mirroring the backend):
 *   - `title`   — required, max 255 chars
 *   - `content` — required
 *
 * Uses Angular 22 block control-flow syntax (@if / @else).
 */
@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TuiButton,
    TuiError,
    TuiLink,
    TuiLoader,
    TuiNotification,
    TuiTextfield,
    TuiBreadcrumbs,
    TuiItem,
    TuiTextarea,
    TuiCard,
  ],
  templateUrl: './recipe-form.component.html',
  styleUrl: './recipe-form.component.scss',
})
export class RecipeFormComponent implements OnInit {
  form: FormGroup;
  isEdit = false;
  recipe: Recipe | null = null;
  loading = false;
  loadError: string | null = null;
  submitting = false;
  submitError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
  ) {
    this.form = this.fb.group({
      title: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      content: ['', Validators.required],
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit = true;
      this.loading = true;
      this.recipeService.getById(Number(id)).subscribe({
        next: (data) => {
          this.recipe = data;
          this.form.patchValue({
            title: data.title,
            description: data.description ?? '',
            content: data.content,
          });
          this.loading = false;
        },
        error: (err) => {
          this.loadError = `Recipe #${id} could not be loaded.`;
          this.loading = false;
          console.error(err);
        },
      });
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { title, description, content } = this.form.value;
    const request = { title, description: description || null, content };

    this.submitting = true;
    this.submitError = null;

    const save$ = this.isEdit && this.recipe
      ? this.recipeService.update(this.recipe.id, request)
      : this.recipeService.create(request);

    save$.subscribe({
      next: (saved) => {
        this.router.navigate(['/recipes', saved.id]);
      },
      error: (err) => {
        if (err.status === 400 && err.error?.errors) {
          const msgs = Object.entries(err.error.errors)
            .map(([f, m]) => `${f}: ${m}`)
            .join('; ');
          this.submitError = `Validation failed — ${msgs}`;
        } else {
          this.submitError = 'Failed to save recipe. Please try again.';
        }
        this.submitting = false;
        console.error(err);
      },
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl && ctrl.invalid && ctrl.touched);
  }

  get titleError(): string {
    const ctrl = this.form.get('title');
    if (ctrl?.errors?.['required']) return 'Title is required.';
    if (ctrl?.errors?.['maxlength']) return 'Title must not exceed 255 characters.';
    return '';
  }
}
