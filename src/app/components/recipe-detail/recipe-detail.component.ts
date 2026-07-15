import { Component, OnInit, SecurityContext } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

/**
 * Shows a single recipe with:
 *   - title, optional description, and creation / update timestamps
 *   - Markdown content rendered to sanitised HTML
 *   - Edit and Delete action buttons
 */
@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div *ngIf="loading" class="loading-spinner"><p>Loading…</p></div>

    <div *ngIf="error" class="alert alert-error">
      {{ error }}
      <br>
      <a routerLink="/recipes">← Back to list</a>
    </div>

    <div *ngIf="recipe && !loading">
      <div class="detail-header">
        <div class="breadcrumb">
          <a routerLink="/recipes">Recipes</a>
          <span> / </span>
          <span>{{ recipe.title }}</span>
        </div>
        <div class="detail-actions">
          <a [routerLink]="['/recipes', recipe.id, 'edit']" class="btn btn-secondary">Edit</a>
          <button class="btn btn-danger" (click)="deleteRecipe()" [disabled]="deleting">
            {{ deleting ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>

      <div class="card detail-card">
        <h1 class="detail-title">{{ recipe.title }}</h1>
        <p *ngIf="recipe.description" class="detail-description">{{ recipe.description }}</p>
        <div class="detail-meta">
          <span>Created {{ recipe.createdAt | date:'medium' }}</span>
          <span *ngIf="recipe.updatedAt !== recipe.createdAt"> · Updated {{ recipe.updatedAt | date:'medium' }}</span>
        </div>
        <hr class="detail-divider">
        <div class="markdown-body" [innerHTML]="renderedContent"></div>
      </div>
    </div>
  `,
  styles: [`
    .detail-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
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

    .detail-actions {
      display: flex;
      gap: 8px;
    }

    .detail-card {
      padding: 28px 32px;
    }

    .detail-title {
      font-size: 26px;
      font-weight: 700;
      margin-bottom: 8px;
      line-height: 1.3;
    }

    .detail-description {
      font-size: 16px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
    }

    .detail-meta {
      font-size: 12px;
      color: var(--color-text-muted);
      margin-bottom: 16px;
    }

    .detail-divider {
      border: none;
      border-top: 1px solid var(--color-border);
      margin: 20px 0;
    }
  `],
})
export class RecipeDetailComponent implements OnInit {
  recipe: Recipe | null = null;
  renderedContent: SafeHtml = '';
  loading = true;
  error: string | null = null;
  deleting = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
    private sanitizer: DomSanitizer,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.recipeService.getById(id).subscribe({
      next: (data) => {
        this.recipe = data;
        const html = marked.parse(data.content) as string;
        this.renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
        this.loading = false;
      },
      error: (err) => {
        this.error = err.status === 404
          ? `Recipe #${id} was not found.`
          : 'Failed to load recipe.';
        this.loading = false;
        console.error(err);
      },
    });
  }

  deleteRecipe(): void {
    if (!this.recipe) return;
    if (!confirm(`Delete "${this.recipe.title}"? This cannot be undone.`)) return;
    this.deleting = true;
    this.recipeService.delete(this.recipe.id).subscribe({
      next: () => {
        this.router.navigate(['/recipes']);
      },
      error: (err) => {
        this.error = 'Failed to delete recipe.';
        this.deleting = false;
        console.error(err);
      },
    });
  }
}
