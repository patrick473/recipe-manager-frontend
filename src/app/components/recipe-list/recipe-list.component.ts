import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

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
  private readonly confirmService = inject(ConfirmDialogService);

  recipes: Recipe[] = [];
  loading = true;
  error: string | null = null;
  deleting: number | null = null;

  constructor(
    private recipeService: RecipeService,
    private cdr: ChangeDetectorRef,
  ) {}

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
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = 'Failed to load recipes. Is the backend running?';
        this.loading = false;
        console.error(err);
        this.cdr.markForCheck();
      },
    });
  }

  deleteRecipe(recipe: Recipe): void {
    this.confirmService
      .confirm({
        label: `Delete "${recipe.title}"?`,
        content: 'This cannot be undone.',
        yes: 'Delete',
        no: 'Cancel',
      })
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;

        this.deleting = recipe.id;
        this.cdr.markForCheck();
        this.recipeService.delete(recipe.id).subscribe({
          next: () => {
            this.recipes = this.recipes.filter((r) => r.id !== recipe.id);
            this.deleting = null;
            this.cdr.markForCheck();
          },
          error: (err) => {
            this.error = `Failed to delete "${recipe.title}".`;
            this.deleting = null;
            console.error(err);
            this.cdr.markForCheck();
          },
        });
      });
  }
}
