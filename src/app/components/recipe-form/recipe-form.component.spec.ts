import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Recipe } from '../../models/recipe.model';
import { RecipeService } from '../../services/recipe.service';
import { RecipeFormComponent } from './recipe-form.component';

const mockRecipe: Recipe = {
  id: 5,
  title: 'Pasta Carbonara',
  description: null,
  content: '## Ingredients\n- Pasta\n- Eggs',
  tags: ['dinner'],
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 2,
  createdAt: '2024-01-01T10:00:00',
  updatedAt: '2024-01-01T10:00:00',
};

describe('RecipeFormComponent', () => {
  let fakeRecipeService: {
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let fakeRouter: { navigate: ReturnType<typeof vi.fn> };

  function configure(routeId: string | null) {
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
      ],
    });
  }

  beforeEach(() => {
    fakeRecipeService = {
      getAll: vi.fn().mockReturnValue(of([])),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    fakeRouter = { navigate: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create mode', () => {
    it('stays out of edit mode with an empty form when there is no :id param', () => {
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['isEdit']()).toBe(false);
      expect(fakeRecipeService.getById).not.toHaveBeenCalled();
      expect(component['form'].getRawValue()).toEqual({
        title: '',
        description: '',
        content: '',
        tags: [],
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      });
    });

    it('calls recipeService.create() with the expected request body on submit', () => {
      fakeRecipeService.create.mockReturnValue(of({ ...mockRecipe, id: 42 }));
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({
        title: 'New Recipe',
        description: 'A tasty one',
        content: '## Ingredients\n- Salt',
      });

      component['onSubmit']();

      expect(fakeRecipeService.create).toHaveBeenCalledWith({
        title: 'New Recipe',
        description: 'A tasty one',
        content: '## Ingredients\n- Salt',
        tags: [],
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      });
    });
  });

  describe('edit mode', () => {
    it('flags isEdit(), loads the recipe, and patches the form (null description coerced to empty string)', () => {
      fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
      configure('5');

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['isEdit']()).toBe(true);
      expect(fakeRecipeService.getById).toHaveBeenCalledWith(5);
      expect(component['form'].get('title')?.value).toBe(mockRecipe.title);
      expect(component['form'].get('description')?.value).toBe('');
      expect(component['form'].get('content')?.value).toBe(mockRecipe.content);
    });

    it('calls recipeService.update(id, ...) on submit', () => {
      fakeRecipeService.getById.mockReturnValue(of(mockRecipe));
      fakeRecipeService.update.mockReturnValue(of({ ...mockRecipe, id: 5 }));
      configure('5');

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({ description: 'Updated description' });
      component['onSubmit']();

      expect(fakeRecipeService.update).toHaveBeenCalledWith(5, {
        title: mockRecipe.title,
        description: 'Updated description',
        content: mockRecipe.content,
        tags: mockRecipe.tags,
        prepTimeMinutes: mockRecipe.prepTimeMinutes,
        cookTimeMinutes: mockRecipe.cookTimeMinutes,
        servings: mockRecipe.servings,
      });
    });

    it('sets loadError() with the id interpolated when loading fails', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fakeRecipeService.getById.mockReturnValue(throwError(() => ({ status: 500 })));
      configure('5');

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['loadError']()).toBe('Recipe #5 could not be loaded.');
    });
  });

  describe('onSubmit()', () => {
    it('is a no-op and marks all controls as touched when the form is invalid', () => {
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['form'].valid).toBe(false);

      component['onSubmit']();

      expect(fakeRecipeService.create).not.toHaveBeenCalled();
      expect(fakeRecipeService.update).not.toHaveBeenCalled();
      expect(component['form'].touched).toBe(true);
    });

    it('navigates to /recipes/:id using the saved recipe id on success', () => {
      fakeRecipeService.create.mockReturnValue(of({ ...mockRecipe, id: 42 }));
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({
        title: 'New Recipe',
        content: '## Ingredients\n- Salt',
      });
      component['onSubmit']();

      expect(fakeRecipeService.create).toHaveBeenCalledWith({
        title: 'New Recipe',
        description: null,
        content: '## Ingredients\n- Salt',
        tags: [],
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      });
      expect(fakeRouter.navigate).toHaveBeenCalledWith(['/recipes', 42]);
    });

    it('renders the per-field validation message on a 400 with err.error.errors', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fakeRecipeService.create.mockReturnValue(
        throwError(() => ({
          status: 400,
          error: { errors: { title: 'must not be blank' } },
        })),
      );
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({
        title: 'New Recipe',
        content: '## Ingredients\n- Salt',
      });
      component['onSubmit']();

      expect(component['submitError']()).toBe('Validation failed — title: must not be blank');
    });

    it('sets a generic submitError() on a non-400 failure', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fakeRecipeService.create.mockReturnValue(throwError(() => ({ status: 500 })));
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({
        title: 'New Recipe',
        content: '## Ingredients\n- Salt',
      });
      component['onSubmit']();

      expect(component['submitError']()).toBe('Failed to save recipe. Please try again.');
    });
  });

  describe('isInvalid() / titleError', () => {
    it('reports the required message when title is empty and touched', () => {
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].get('title')?.markAsTouched();

      expect(component['isInvalid']('title')).toBe(true);
      expect(component['titleError']).toBe('Title is required.');
    });

    it('reports the maxlength message when title exceeds 255 characters', () => {
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const longTitle = 'a'.repeat(256);
      component['form'].get('title')?.setValue(longTitle);
      component['form'].get('title')?.markAsTouched();

      expect(component['isInvalid']('title')).toBe(true);
      expect(component['titleError']).toBe('Title must not exceed 255 characters.');
    });

    it('reports not invalid when title is untouched', () => {
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['isInvalid']('title')).toBe(false);
    });
  });
});
