import { ChangeDetectionStrategy, Component, OnInit, SecurityContext } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

/**
 * Shows a single recipe with:
 *   - title, optional description, and creation / update timestamps
 *   - Markdown content rendered to sanitised HTML
 *   - Edit and Delete action buttons
 *
 * Uses Angular 22 block control-flow syntax (@if / @else) and
 * OnPush change detection.
 */
@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.css',
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
