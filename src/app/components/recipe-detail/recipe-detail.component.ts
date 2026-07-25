import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
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
import { LoaderComponent } from '../../shared/loader/loader.component';

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
  imports: [RouterLink, DatePipe, ButtonDirective, IconComponent, LoaderComponent],
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
  protected readonly renderedContent = signal<SafeHtml>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly deleting = signal(false);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.recipeService
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.recipe.set(data);
          const html = marked.parse(data.content) as string;
          this.renderedContent.set(this.sanitizer.bypassSecurityTrustHtml(html));
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
