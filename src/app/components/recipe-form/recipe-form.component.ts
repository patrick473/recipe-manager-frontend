import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
 */
@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="form-page-header">
      <div class="breadcrumb">
        <a routerLink="/recipes">Recipes</a>
        <ng-container *ngIf="isEdit && recipe">
          <span> / </span>
          <a [routerLink]="['/recipes', recipe.id]">{{ recipe.title }}</a>
        </ng-container>
        <span> / </span>
        <span>{{ isEdit ? 'Edit' : 'New Recipe' }}</span>
      </div>
    </div>

    <div *ngIf="loadError" class="alert alert-error">{{ loadError }}</div>

    <div *ngIf="loading" class="loading-spinner"><p>Loading…</p></div>

    <div class="card" *ngIf="!loading">
      <h2 class="form-title">{{ isEdit ? 'Edit Recipe' : 'New Recipe' }}</h2>

      <div *ngIf="submitError" class="alert alert-error">{{ submitError }}</div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>

        <!-- Title -->
        <div class="form-group">
          <label for="title">Title <span class="required-marker">*</span></label>
          <input
            id="title"
            type="text"
            formControlName="title"
            placeholder="e.g. Classic Banana Bread"
            [class.is-invalid]="isInvalid('title')"
            autocomplete="off"
          />
          <span *ngIf="isInvalid('title')" class="field-error">
            {{ titleError }}
          </span>
        </div>

        <!-- Description -->
        <div class="form-group">
          <label for="description">Description <span class="optional-label">(optional)</span></label>
          <input
            id="description"
            type="text"
            formControlName="description"
            placeholder="One-line summary shown in the recipe list"
            autocomplete="off"
          />
        </div>

        <!-- Content (Markdown) -->
        <div class="form-group">
          <label for="content">Content (Markdown) <span class="required-marker">*</span></label>
          <textarea
            id="content"
            formControlName="content"
            rows="16"
            placeholder="## Ingredients&#10;- ...&#10;&#10;## Steps&#10;1. ..."
            [class.is-invalid]="isInvalid('content')"
          ></textarea>
          <span *ngIf="isInvalid('content')" class="field-error">
            Content is required.
          </span>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary" [disabled]="submitting">
            {{ submitting ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create Recipe') }}
          </button>
          <ng-container *ngIf="isEdit && recipe; else cancelToList">
            <a [routerLink]="['/recipes', recipe.id]" class="btn btn-secondary">Cancel</a>
          </ng-container>
          <ng-template #cancelToList>
            <a routerLink="/recipes" class="btn btn-secondary">Cancel</a>
          </ng-template>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .form-page-header {
      margin-bottom: 20px;
    }

    .breadcrumb {
      font-size: 14px;
      color: var(--color-text-muted);
    }

    .breadcrumb a {
      color: var(--color-primary);
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .form-title {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 20px;
    }

    .optional-label {
      font-size: 12px;
      color: var(--color-text-muted);
      font-weight: 400;
      margin-left: 4px;
    }
  `],
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
