import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

/**
 * Displays a card grid of all recipes. Each card links to the detail view.
 * Provides per-card delete with optimistic removal from the list.
 *
 * Uses Angular 22 block control-flow (@if / @for / @empty) and
 * OnPush change detection for better runtime performance.
 */
@Component({
    selector: 'app-recipe-list',
    imports: [RouterLink, DatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './recipe-list.component.html',
    styleUrl: './recipe-list.component.css',
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
