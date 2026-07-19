import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';
import { LoaderComponent } from '../../shared/loader/loader.component';
import { ConfirmDialogService } from '../../shared/confirm-dialog/confirm-dialog.service';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';

/**
 * Shows a single recipe with:
 *   - title, optional description, and creation / update timestamps
 *   - Markdown content rendered to sanitised HTML
 *   - Edit and Delete action buttons
 *
 * Uses Angular 22 block control-flow syntax (@if / @else).
 */
@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [RouterLink, DatePipe, ButtonDirective, IconComponent, LoaderComponent],
  templateUrl: './recipe-detail.component.html',
  styleUrl: './recipe-detail.component.scss',
})
export class RecipeDetailComponent implements OnInit {
  private readonly confirmService = inject(ConfirmDialogService);

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
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.recipeService.getById(id).subscribe({
      next: (data) => {
        this.recipe = data;
        const html = marked.parse(data.content) as string;
        this.renderedContent = this.sanitizer.bypassSecurityTrustHtml(html);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err.status === 404
          ? `Recipe #${id} was not found.`
          : 'Failed to load recipe.';
        this.loading = false;
        console.error(err);
        this.cdr.markForCheck();
      },
    });
  }

  deleteRecipe(): void {
    if (!this.recipe) return;
    const recipe = this.recipe;

    this.confirmService
      .confirm({
        label: `Delete "${recipe.title}"?`,
        content: 'This cannot be undone.',
        yes: 'Delete',
        no: 'Cancel',
      })
      .subscribe((confirmed: boolean) => {
        if (!confirmed) return;

        this.deleting = true;
        this.cdr.markForCheck();
        this.recipeService.delete(recipe.id).subscribe({
          next: () => {
            this.router.navigate(['/recipes']);
          },
          error: (err) => {
            this.error = 'Failed to delete recipe.';
            this.deleting = false;
            console.error(err);
            this.cdr.markForCheck();
          },
        });
      });
  }
}
