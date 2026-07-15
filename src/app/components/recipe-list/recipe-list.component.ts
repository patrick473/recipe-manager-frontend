import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

/**
 * Displays a card grid of all recipes. Each card links to the detail view.
 * Provides per-card delete with optimistic removal from the list.
 */
@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="recipe-list-header">
      <h2>Recipes</h2>
    </div>

    <div *ngIf="error" class="alert alert-error">{{ error }}</div>

    <div *ngIf="loading" class="loading-spinner">
      <p>Loading recipes…</p>
    </div>

    <div *ngIf="!loading && recipes.length === 0 && !error" class="empty-state">
      <h2>No recipes yet</h2>
      <p>Create your first recipe to get started.</p>
      <a routerLink="/recipes/new" class="btn btn-primary">+ New Recipe</a>
    </div>

    <div *ngIf="!loading && recipes.length > 0" class="recipe-grid">
      <div *ngFor="let recipe of recipes" class="recipe-card card">
        <div class="recipe-card-body">
          <h3 class="recipe-card-title">
            <a [routerLink]="['/recipes', recipe.id]">{{ recipe.title }}</a>
          </h3>
          <p *ngIf="recipe.description" class="recipe-card-description">{{ recipe.description }}</p>
          <p *ngIf="!recipe.description" class="recipe-card-description muted">No description</p>
          <p class="recipe-card-date">Updated {{ recipe.updatedAt | date:'mediumDate' }}</p>
        </div>
        <div class="recipe-card-actions">
          <a [routerLink]="['/recipes', recipe.id, 'edit']" class="btn btn-secondary btn-sm">Edit</a>
          <button class="btn btn-danger btn-sm" (click)="deleteRecipe(recipe)" [disabled]="deleting === recipe.id">
            {{ deleting === recipe.id ? 'Deleting…' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .recipe-list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }

    .recipe-list-header h2 {
      font-size: 22px;
      font-weight: 600;
    }

    .recipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .recipe-card {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .recipe-card-body {
      flex: 1;
    }

    .recipe-card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 6px;
    }

    .recipe-card-title a {
      color: inherit;
      text-decoration: none;
    }

    .recipe-card-title a:hover {
      color: var(--color-primary);
    }

    .recipe-card-description {
      font-size: 14px;
      color: var(--color-text-muted);
      margin-bottom: 8px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .recipe-card-date {
      font-size: 12px;
      color: var(--color-text-muted);
    }

    .recipe-card-actions {
      display: flex;
      gap: 8px;
    }

    .btn-sm {
      padding: 4px 10px;
      font-size: 13px;
    }

    .muted {
      font-style: italic;
    }
  `],
})
export class RecipeListComponent implements OnInit {
  recipes: Recipe[] = [];
  loading = true;
  error: string | null = null;
  deleting: number | null = null;

  constructor(private recipeService: RecipeService) {}

  ngOnInit(): void {
    this.loadRecipes();
  }

  loadRecipes(): void {
    this.loading = true;
    this.error = null;
    this.recipeService.getAll().subscribe({
      next: (data) => {
        this.recipes = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load recipes. Is the backend running?';
        this.loading = false;
        console.error(err);
      },
    });
  }

  deleteRecipe(recipe: Recipe): void {
    if (!confirm(`Delete "${recipe.title}"? This cannot be undone.`)) {
      return;
    }
    this.deleting = recipe.id;
    this.recipeService.delete(recipe.id).subscribe({
      next: () => {
        this.recipes = this.recipes.filter((r) => r.id !== recipe.id);
        this.deleting = null;
      },
      error: (err) => {
        this.error = `Failed to delete "${recipe.title}".`;
        this.deleting = null;
        console.error(err);
      },
    });
  }
}
