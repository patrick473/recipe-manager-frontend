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
  ingredients: [{ quantity: 200, unit: 'g', name: 'pasta' }, { name: 'eggs' }],
  steps: [{ instruction: 'Cook the pasta.' }],
  tags: ['dinner'],
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 2,
  createdAt: '2024-01-01T10:00:00',
  updatedAt: '2024-01-01T10:00:00',
};

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File(['x'.repeat(Math.min(sizeBytes, 10))], name, { type });
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('RecipeFormComponent', () => {
  let fakeRecipeService: {
    getAll: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    uploadImage: ReturnType<typeof vi.fn>;
    deleteImage: ReturnType<typeof vi.fn>;
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
      getAll: vi
        .fn()
        .mockReturnValue(of({ content: [], page: 0, size: 100, totalElements: 0, totalPages: 0 })),
      getById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      uploadImage: vi.fn(),
      deleteImage: vi.fn(),
    };
    fakeRouter = { navigate: vi.fn() };

    URL.createObjectURL = vi.fn().mockReturnValue('blob:fake-object-url');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    history.replaceState(null, '', window.location.href);
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
        ingredients: [{ name: '' }],
        steps: [{ instruction: '' }],
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
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
      });

      component['onSubmit']();

      expect(fakeRecipeService.create).toHaveBeenCalledWith({
        title: 'New Recipe',
        description: 'A tasty one',
        content: '## Ingredients\n- Salt',
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
        tags: [],
        prepTimeMinutes: null,
        cookTimeMinutes: null,
        servings: null,
      });
    });
  });

  describe('clone mode', () => {
    it('prefills the form from history.state.cloneFrom with a " (Copy)"-suffixed title, staying in create mode', () => {
      history.pushState({ cloneFrom: mockRecipe }, '');
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['isEdit']()).toBe(false);
      expect(fakeRecipeService.getById).not.toHaveBeenCalled();
      expect(component['form'].getRawValue()).toEqual({
        title: 'Pasta Carbonara (Copy)',
        description: '',
        content: mockRecipe.content,
        ingredients: mockRecipe.ingredients,
        steps: mockRecipe.steps,
        tags: mockRecipe.tags,
        prepTimeMinutes: mockRecipe.prepTimeMinutes,
        cookTimeMinutes: mockRecipe.cookTimeMinutes,
        servings: mockRecipe.servings,
      });
    });

    it('calls recipeService.create() (not update()) on submit', () => {
      history.pushState({ cloneFrom: mockRecipe }, '');
      fakeRecipeService.create.mockReturnValue(of({ ...mockRecipe, id: 99 }));
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['onSubmit']();

      expect(fakeRecipeService.create).toHaveBeenCalledWith({
        title: 'Pasta Carbonara (Copy)',
        description: null,
        content: mockRecipe.content,
        ingredients: mockRecipe.ingredients,
        steps: mockRecipe.steps,
        tags: mockRecipe.tags,
        prepTimeMinutes: mockRecipe.prepTimeMinutes,
        cookTimeMinutes: mockRecipe.cookTimeMinutes,
        servings: mockRecipe.servings,
      });
      expect(fakeRecipeService.update).not.toHaveBeenCalled();
    });

    it('coerces missing tags/prepTime/cookTime/servings to empty/null defaults', () => {
      const sparseRecipe: Recipe = {
        ...mockRecipe,
        tags: undefined,
        prepTimeMinutes: undefined,
        cookTimeMinutes: undefined,
        servings: undefined,
      };
      history.pushState({ cloneFrom: sparseRecipe }, '');
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['form'].get('tags')?.value).toEqual([]);
      expect(component['form'].get('prepTimeMinutes')?.value).toBeNull();
      expect(component['form'].get('cookTimeMinutes')?.value).toBeNull();
      expect(component['form'].get('servings')?.value).toBeNull();
    });

    it('ignores history.state.cloneFrom when a :id route param is present (edit mode takes precedence)', () => {
      history.pushState({ cloneFrom: mockRecipe }, '');
      fakeRecipeService.getById.mockReturnValue(of({ ...mockRecipe, id: 5, title: 'Original' }));
      configure('5');

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['isEdit']()).toBe(true);
      expect(component['form'].get('title')?.value).toBe('Original');
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

    it('coerces missing tags/prepTime/cookTime/servings to empty/null defaults', () => {
      const sparseRecipe: Recipe = {
        ...mockRecipe,
        tags: undefined,
        prepTimeMinutes: undefined,
        cookTimeMinutes: undefined,
        servings: undefined,
      };
      fakeRecipeService.getById.mockReturnValue(of(sparseRecipe));
      configure('5');

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['form'].get('tags')?.value).toEqual([]);
      expect(component['form'].get('prepTimeMinutes')?.value).toBeNull();
      expect(component['form'].get('cookTimeMinutes')?.value).toBeNull();
      expect(component['form'].get('servings')?.value).toBeNull();
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
        ingredients: mockRecipe.ingredients,
        steps: mockRecipe.steps,
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
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
      });
      component['onSubmit']();

      expect(fakeRecipeService.create).toHaveBeenCalledWith({
        title: 'New Recipe',
        description: null,
        content: '## Ingredients\n- Salt',
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
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
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
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
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
      });
      component['onSubmit']();

      expect(component['submitError']()).toBe('Failed to save recipe. Please try again.');
    });
  });

  describe('image handling', () => {
    function selectFile(component: RecipeFormComponent, file: File | undefined): void {
      const input = { files: file ? [file] : [] } as unknown as HTMLInputElement;
      component['onFileSelected']({ target: input } as unknown as Event);
    }

    it('rejects an oversized file: sets imageError, does not set selectedFile, no network call fires', () => {
      configure(null);
      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const oversized = makeFile('photo.jpg', 'image/jpeg', 6 * 1024 * 1024);
      selectFile(component, oversized);

      expect(component['imageError']()).toBe('Image must be 5MB or smaller.');
      expect(component['selectedFile']()).toBeNull();
      expect(component['imagePreviewUrl']()).toBeNull();
    });

    it('rejects a wrong-type file: sets imageError, does not set selectedFile, no network call fires', () => {
      configure(null);
      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const wrongType = makeFile('photo.heic', 'image/heic', 1024);
      selectFile(component, wrongType);

      expect(component['imageError']()).toBe('Please choose a JPEG, PNG, or WebP image.');
      expect(component['selectedFile']()).toBeNull();
      expect(component['imagePreviewUrl']()).toBeNull();
    });

    it('is a no-op when the file input has no selected file', () => {
      configure(null);
      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      selectFile(component, undefined);

      expect(component['imageError']()).toBeNull();
      expect(component['selectedFile']()).toBeNull();
    });

    it('accepts a valid file: sets selectedFile/imagePreviewUrl and clears imageError/imageRemoved', () => {
      configure(null);
      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      const valid = makeFile('photo.png', 'image/png', 1024);
      selectFile(component, valid);

      expect(component['imageError']()).toBeNull();
      expect(component['selectedFile']()).toBe(valid);
      expect(component['imagePreviewUrl']()).toBe('blob:fake-object-url');
      expect(component['imageRemoved']()).toBe(false);
    });

    it('create mode: submitting with a selected file fires create-then-upload in order, navigating only after both settle', () => {
      const created = { ...mockRecipe, id: 42 };
      fakeRecipeService.create.mockReturnValue(of(created));
      fakeRecipeService.uploadImage.mockReturnValue(
        of({ ...created, imageUrl: '/recipes/42/image' }),
      );
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({
        title: 'New Recipe',
        content: '## Ingredients\n- Salt',
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
      });
      const file = makeFile('photo.png', 'image/png', 1024);
      selectFile(component, file);

      component['onSubmit']();

      expect(fakeRecipeService.create).toHaveBeenCalled();
      expect(fakeRecipeService.uploadImage).toHaveBeenCalledWith(42, file);
      expect(fakeRouter.navigate).toHaveBeenCalledWith(['/recipes', 42]);
    });

    it('edit mode: clicking "Remove image" then submitting fires update-then-delete', () => {
      fakeRecipeService.getById.mockReturnValue(
        of({ ...mockRecipe, imageUrl: '/recipes/5/image' }),
      );
      fakeRecipeService.update.mockReturnValue(of({ ...mockRecipe, id: 5 }));
      fakeRecipeService.deleteImage.mockReturnValue(of({ ...mockRecipe, id: 5, imageUrl: null }));
      configure('5');

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['imagePreviewUrl']()).toContain('/recipes/5/image');

      component['onRemoveImage']();
      component['onSubmit']();

      expect(fakeRecipeService.update).toHaveBeenCalled();
      expect(fakeRecipeService.deleteImage).toHaveBeenCalledWith(5);
      expect(fakeRecipeService.uploadImage).not.toHaveBeenCalled();
      expect(fakeRouter.navigate).toHaveBeenCalledWith(['/recipes', 5]);
    });

    it('create mode: a failed image upload still navigates to the created recipe rather than showing a generic submit error', () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const created = { ...mockRecipe, id: 42 };
      fakeRecipeService.create.mockReturnValue(of(created));
      fakeRecipeService.uploadImage.mockReturnValue(throwError(() => ({ status: 500 })));
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].patchValue({
        title: 'New Recipe',
        content: '## Ingredients\n- Salt',
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
      });
      const file = makeFile('photo.png', 'image/png', 1024);
      selectFile(component, file);

      component['onSubmit']();

      expect(fakeRouter.navigate).toHaveBeenCalledWith(['/recipes', 42], {
        state: { imageUploadFailed: true },
      });
      expect(component['submitError']()).toBeNull();
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

    it('reports no title error once the title is valid', () => {
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      component['form'].get('title')?.setValue('A valid title');

      expect(component['titleError']).toBe('');
    });
  });

  describe('tag suggestions', () => {
    it('collects and de-duplicates tags across all recipes, treating a missing tags array as empty', () => {
      fakeRecipeService.getAll.mockReturnValue(
        of({
          content: [
            { ...mockRecipe, id: 1, tags: ['dinner', 'quick'] },
            { ...mockRecipe, id: 2, tags: undefined },
            { ...mockRecipe, id: 3, tags: ['quick', 'dessert'] },
          ],
          page: 0,
          size: 100,
          totalElements: 3,
          totalPages: 1,
        }),
      );
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['tagSuggestions']()).toEqual(['dessert', 'dinner', 'quick']);
    });

    it('logs the error and leaves tagSuggestions empty when loading suggestions fails', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      fakeRecipeService.getAll.mockReturnValue(throwError(() => new Error('boom')));
      configure(null);

      const fixture = TestBed.createComponent(RecipeFormComponent);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(component['tagSuggestions']()).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
