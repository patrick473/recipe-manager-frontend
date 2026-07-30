import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Recipe } from '../../models/recipe.model';
import { FavoritesService } from '../../services/favorites.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { RecipeService } from '../../services/recipe.service';
import { RecipeDetailComponent } from './recipe-detail.component';

const mockRecipe: Recipe = {
  id: 1,
  title: 'Pasta Carbonara',
  description: 'Classic Italian pasta',
  content: 'plain text',
  createdAt: '2024-01-01T10:00:00',
  updatedAt: '2024-01-01T10:00:00',
};

const scalableContent = '## Ingredients\n\n- 2 cups flour\n- 1 egg\n\n## Instructions\n\n1. Mix.\n';

describe('RecipeDetailComponent', () => {
  let fakeRecipeService: {
    getById: ReturnType<typeof vi.fn>;
    deleteWithConfirm: ReturnType<typeof vi.fn>;
  };
  let fakeRouter: { navigate: ReturnType<typeof vi.fn> };
  let fakeSanitizer: { bypassSecurityTrustHtml: ReturnType<typeof vi.fn> };
  let fakeRecentlyViewedService: { record: ReturnType<typeof vi.fn> };

  function configure(routeId: string | null = '1') {
    const fakeRoute = {
      snapshot: {
        paramMap: {
          get: () => routeId,
        },
      },
    } as unknown as ActivatedRoute;

    TestBed.configureTestingModule({
      providers: [
        { provide: RecipeService, useValue: fakeRecipeService },
        { provide: Router, useValue: fakeRouter },
        { provide: ActivatedRoute, useValue: fakeRoute },
        { provide: DomSanitizer, useValue: fakeSanitizer },
        { provide: RecentlyViewedService, useValue: fakeRecentlyViewedService },
      ],
    });
  }

  beforeEach(() => {
    localStorage.clear();

    fakeRecipeService = {
      getById: vi.fn(),
      deleteWithConfirm: vi.fn(),
    };
    fakeRouter = { navigate: vi.fn() };
    fakeSanitizer = {
      bypassSecurityTrustHtml: vi.fn((html: string) => html),
    };
    fakeRecentlyViewedService = { record: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads :id from the route, loads the recipe, and sanitizes the rendered content', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fakeRecipeService.getById).toHaveBeenCalledWith(1);
    expect(component['recipe']()).toEqual(mockRecipe);
    expect(component['loading']()).toBe(false);
    expect(fakeSanitizer.bypassSecurityTrustHtml).toHaveBeenCalledWith('<p>plain text</p>\n');
    expect(component['renderedContent']()).toBe('<p>plain text</p>\n');
  });

  it('sets a "not found" message on a 404 load error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeRecipeService.getById.mockReturnValue(throwError(() => ({ status: 404 })));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['error']()).toBe('Recipe #1 was not found.');
    expect(component['loading']()).toBe(false);
  });

  it('sets a generic message on a non-404 load error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeRecipeService.getById.mockReturnValue(throwError(() => ({ status: 500 })));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component['error']()).toBe('Failed to load recipe.');
    expect(component['loading']()).toBe(false);
  });

  it('records the recipe as recently viewed on a successful load', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    expect(fakeRecentlyViewedService.record).toHaveBeenCalledWith(mockRecipe.id);
    expect(fakeRecentlyViewedService.record).toHaveBeenCalledTimes(1);
  });

  it('does not record a view on a 404/error load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeRecipeService.getById.mockReturnValue(throwError(() => ({ status: 404 })));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    expect(fakeRecentlyViewedService.record).not.toHaveBeenCalled();
  });

  it('navigates to /recipes when the delete is confirmed', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockImplementation(
      (recipe: Recipe, onConfirmed?: () => void) => {
        onConfirmed?.();
        return delete$.asObservable();
      },
    );
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe']();
    delete$.next(true);
    delete$.complete();

    expect(fakeRouter.navigate).toHaveBeenCalledWith(['/recipes']);
  });

  it('does not navigate when the delete is cancelled', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockReturnValue(delete$.asObservable());
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe']();
    delete$.next(false);
    delete$.complete();

    expect(fakeRouter.navigate).not.toHaveBeenCalled();
    expect(component['deleting']()).toBe(false);
  });

  it('navigates to /recipes/new with the recipe in router state when cloning', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['cloneRecipe']();

    expect(fakeRouter.navigate).toHaveBeenCalledWith(['/recipes/new'], {
      state: { cloneFrom: mockRecipe },
    });
  });

  it('renders a hero <img> with the resolved src when the recipe has an imageUrl', () => {
    const recipeWithImage: Recipe = { ...mockRecipe, imageUrl: '/recipes/1/image' };
    fakeRecipeService.getById.mockReturnValue(of(recipeWithImage));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const img = element.querySelector('.detail-hero') as HTMLImageElement;

    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('http://localhost:8080/recipes/1/image');
  });

  it('renders no hero image (and no placeholder) when the recipe has no imageUrl', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.detail-hero')).toBeNull();
  });

  it('shows the image-upload-failed notification when navigated here with that router state', () => {
    vi.spyOn(window.history, 'state', 'get').mockReturnValue({ imageUploadFailed: true });
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Recipe created, but the image failed to upload');
  });

  it('does not show the image-upload-failed notification on a normal visit', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('failed to upload');
  });

  it('sets error() and clears deleting() on delete failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    const delete$ = new Subject<boolean>();
    fakeRecipeService.deleteWithConfirm.mockImplementation(
      (recipe: Recipe, onConfirmed?: () => void) => {
        onConfirmed?.();
        return delete$.asObservable();
      },
    );
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['deleteRecipe']();
    delete$.error(new Error('boom'));

    expect(component['error']()).toBe('Failed to delete recipe.');
    expect(component['deleting']()).toBe(false);
    expect(fakeRouter.navigate).not.toHaveBeenCalled();
  });

  it('does not render the scale control for a recipe with no scalable ingredients', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.scale-control')).toBeNull();
  });

  it('shows a servings stepper, seeded at the recipe servings, when servings is set', () => {
    const recipe: Recipe = { ...mockRecipe, content: scalableContent, servings: 4 };
    fakeRecipeService.getById.mockReturnValue(of(recipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.stepper-value')?.textContent?.trim()).toBe('4');
    expect(element.querySelector('.multiplier-group')).toBeNull();
  });

  it('shows multiplier buttons instead of a stepper when the recipe has no servings', () => {
    const recipe: Recipe = { ...mockRecipe, content: scalableContent, servings: null };
    fakeRecipeService.getById.mockReturnValue(of(recipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.multiplier-group')).toBeTruthy();
    expect(element.querySelector('.stepper')).toBeNull();
  });

  it('scales rendered ingredient quantities when the servings stepper changes', () => {
    const recipe: Recipe = { ...mockRecipe, content: scalableContent, servings: 4 };
    fakeRecipeService.getById.mockReturnValue(of(recipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['onServingsTargetChange'](8);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.markdown-body')?.innerHTML).toContain('4 cups flour');
    expect(element.querySelector('.markdown-body')?.innerHTML).not.toContain('2 cups flour');
  });

  it('scales rendered ingredient quantities when a multiplier button is selected', () => {
    const recipe: Recipe = { ...mockRecipe, content: scalableContent, servings: null };
    fakeRecipeService.getById.mockReturnValue(of(recipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['onMultiplierSelect'](2);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.markdown-body')?.innerHTML).toContain('4 cups flour');
  });

  it('reflects FavoritesService state on the favorite button and updates it on click', () => {
    fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    fixture.detectChanges();

    const favoritesService = TestBed.inject(FavoritesService);
    const element = fixture.nativeElement as HTMLElement;
    const favoriteButton = element.querySelector(
      'button[aria-label="Add to favorites"], button[aria-label="Remove from favorites"]',
    ) as HTMLButtonElement;

    expect(favoriteButton).toBeTruthy();
    expect(favoritesService.isFavorite(mockRecipe.id)).toBe(false);
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Add to favorites');
    expect(favoriteButton.querySelector('.material-icons')?.textContent).toBe('favorite_border');

    favoriteButton.click();
    fixture.detectChanges();

    expect(favoritesService.isFavorite(mockRecipe.id)).toBe(true);
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('true');
    expect(favoriteButton.getAttribute('aria-label')).toBe('Remove from favorites');
    expect(favoriteButton.querySelector('.material-icons')?.textContent).toBe('favorite');

    favoriteButton.click();
    fixture.detectChanges();

    expect(favoritesService.isFavorite(mockRecipe.id)).toBe(false);
    expect(favoriteButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('resets the scale factor back to 1 when a different recipe loads', () => {
    const recipe: Recipe = { ...mockRecipe, content: scalableContent, servings: 4 };
    fakeRecipeService.getById.mockReturnValue(of(recipe));
    configure('1');

    const fixture = TestBed.createComponent(RecipeDetailComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component['onServingsTargetChange'](8);
    expect(component['scaleFactor']()).toBe(2);

    component['ngOnInit']();
    expect(component['scaleFactor']()).toBe(1);
  });
});
