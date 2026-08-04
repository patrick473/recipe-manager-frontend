import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Recipe, RecipePageResponse, RecipeRequest } from '../models/recipe.model';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';
import { RecipeService } from './recipe.service';

const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Pasta Carbonara',
    description: 'Classic Italian pasta',
    content: '## Ingredients\n- Pasta\n- Eggs',
    ingredients: [], steps: [],
    createdAt: '2024-01-01T10:00:00',
    updatedAt: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    title: 'Banana Bread',
    description: null,
    content: '## Ingredients\n- Bananas\n- Flour',
    ingredients: [], steps: [],
    createdAt: '2024-01-02T10:00:00',
    updatedAt: '2024-01-02T10:00:00',
  },
];

const mockPageResponse: RecipePageResponse = {
  content: mockRecipes,
  page: 0,
  size: 20,
  totalElements: 2,
  totalPages: 1,
};

describe('RecipeService', () => {
  let service: RecipeService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(RecipeService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should expose recipeCount and hasRecipes signals', () => {
    expect(service.recipeCount()).toBe(0);
    expect(service.hasRecipes()).toBe(false);
  });

  it('getAll() should fetch a page of recipes and update recipeCount from totalElements', () => {
    let result: RecipePageResponse | undefined;
    service
      .getAll({ q: 'pasta', tags: ['dinner'], sort: 'title,asc', page: 0, size: 20 })
      .subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('/recipes'));
    expect(req.request.params.get('q')).toBe('pasta');
    expect(req.request.params.get('sort')).toBe('title,asc');
    expect(req.request.params.get('page')).toBe('0');
    expect(req.request.params.get('size')).toBe('20');
    req.flush(mockPageResponse);

    expect(result).toEqual(mockPageResponse);
    expect(service.recipeCount()).toBe(2);
    expect(service.hasRecipes()).toBe(true);
  });

  it('getAll() sets recipeCount from totalElements, not the current page size', () => {
    service.getAll({}).subscribe();
    httpMock
      .expectOne((r) => r.url.includes('/recipes'))
      .flush({ ...mockPageResponse, content: [mockRecipes[0]], totalElements: 42 });

    expect(service.recipeCount()).toBe(42);
  });

  it('getAll() clears the loading signal when the request errors', () => {
    let error: unknown;
    service.getAll({}).subscribe({
      next: () => {
        throw new Error('expected an error, got a value');
      },
      error: (err) => (error = err),
    });
    expect(service.loading()).toBe(true);

    httpMock
      .expectOne((r) => r.url.includes('/recipes'))
      .flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(service.loading()).toBe(false);
    expect((error as { status: number }).status).toBe(500);
  });

  it('delete() should decrement recipeCount signal', () => {
    // Seed the count
    service.getAll({}).subscribe();
    httpMock.expectOne((r) => r.url.includes('/recipes')).flush(mockPageResponse);
    expect(service.recipeCount()).toBe(2);

    service.delete(1).subscribe();
    httpMock.expectOne((r) => r.url.includes('/recipes/1')).flush(null);
    expect(service.recipeCount()).toBe(1);
  });

  describe('getById()', () => {
    it('fetches a single recipe by id', () => {
      let result: Recipe | undefined;
      service.getById(1).subscribe((r) => (result = r));

      const req = httpMock.expectOne('/recipes/1');
      expect(req.request.method).toBe('GET');
      req.flush(mockRecipes[0]);

      expect(result).toEqual(mockRecipes[0]);
    });

    it('passes through a 404 error to the subscriber', () => {
      let error: unknown;
      service.getById(999).subscribe({
        next: () => {
          throw new Error('expected an error, got a value');
        },
        error: (err) => (error = err),
      });

      const req = httpMock.expectOne('/recipes/999');
      req.flush('Not Found', { status: 404, statusText: 'Not Found' });

      expect((error as { status: number }).status).toBe(404);
    });
  });

  describe('create()', () => {
    it('posts the request body and returns the created recipe', () => {
      const request: RecipeRequest = {
        title: 'New Recipe',
        description: 'A brand new recipe',
        content: '## Ingredients\n- Salt',
        ingredients: [{ name: 'Salt' }],
        steps: [{ instruction: 'Season.' }],
      };
      let result: Recipe | undefined;

      service.create(request).subscribe((r) => (result = r));

      const req = httpMock.expectOne('/recipes');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);

      const created: Recipe = { ...mockRecipes[0], id: 3, ...request };
      req.flush(created);

      expect(result).toEqual(created);
    });

    it('increments recipeCount on success', () => {
      expect(service.recipeCount()).toBe(0);

      service.create({ title: 'New Recipe', ingredients: [{ name: 'Salt' }], steps: [{ instruction: 'Season.' }] }).subscribe();
      httpMock.expectOne('/recipes').flush(mockRecipes[0]);

      expect(service.recipeCount()).toBe(1);
    });
  });

  describe('update()', () => {
    it('puts to /recipes/:id and returns the updated recipe', () => {
      const request: RecipeRequest = {
        title: 'Updated Recipe',
        description: 'Updated description',
        content: '## Ingredients\n- Pepper',
        ingredients: [{ name: 'Pepper' }],
        steps: [{ instruction: 'Season.' }],
      };
      let result: Recipe | undefined;

      service.update(1, request).subscribe((r) => (result = r));

      const req = httpMock.expectOne((r) => r.url.includes('/recipes/1'));
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(request);

      const updated: Recipe = { ...mockRecipes[0], ...request };
      req.flush(updated);

      expect(result).toEqual(updated);
    });
  });

  describe('uploadImage()', () => {
    it('posts a FormData body with the file to /recipes/:id/image and returns the updated recipe', () => {
      const file = new File(['bytes'], 'photo.jpg', { type: 'image/jpeg' });
      let result: Recipe | undefined;

      service.uploadImage(1, file).subscribe((r) => (result = r));

      const req = httpMock.expectOne((r) => r.url.includes('/recipes/1/image'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toBeInstanceOf(FormData);
      expect((req.request.body as FormData).get('file')).toBe(file);

      const updated: Recipe = { ...mockRecipes[0], imageUrl: '/recipes/1/image' };
      req.flush(updated);

      expect(result).toEqual(updated);
    });
  });

  describe('deleteImage()', () => {
    it('deletes /recipes/:id/image and returns the updated recipe', () => {
      let result: Recipe | undefined;

      service.deleteImage(1).subscribe((r) => (result = r));

      const req = httpMock.expectOne((r) => r.url.includes('/recipes/1/image'));
      expect(req.request.method).toBe('DELETE');

      const updated: Recipe = { ...mockRecipes[0], imageUrl: null };
      req.flush(updated);

      expect(result).toEqual(updated);
    });
  });

  describe('deleteWithConfirm()', () => {
    it('emits false and makes no HTTP call when the user cancels', () => {
      const confirmDialogService = TestBed.inject(ConfirmDialogService);
      let result: boolean | undefined;

      service.deleteWithConfirm(mockRecipes[0]).subscribe((r) => (result = r));
      confirmDialogService.respond(false);

      expect(result).toBe(false);
      httpMock.expectNone((r) => r.url.includes('/recipes/1'));
    });

    it('fires the DELETE request and emits true when the user confirms', () => {
      const confirmDialogService = TestBed.inject(ConfirmDialogService);
      let result: boolean | undefined;
      let confirmedCallbackFired = false;

      service
        .deleteWithConfirm(mockRecipes[0], () => (confirmedCallbackFired = true))
        .subscribe((r) => (result = r));
      confirmDialogService.respond(true);

      expect(confirmedCallbackFired).toBe(true);
      httpMock.expectOne((r) => r.url.includes('/recipes/1')).flush(null);
      expect(result).toBe(true);
    });
  });
});
