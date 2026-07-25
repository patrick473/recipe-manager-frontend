import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Recipe } from '../models/recipe.model';
import { ConfirmDialogService } from '../shared/confirm-dialog/confirm-dialog.service';
import { RecipeService } from './recipe.service';

const mockRecipes: Recipe[] = [
  {
    id: 1,
    title: 'Pasta Carbonara',
    description: 'Classic Italian pasta',
    content: '## Ingredients\n- Pasta\n- Eggs',
    createdAt: '2024-01-01T10:00:00',
    updatedAt: '2024-01-01T10:00:00',
  },
  {
    id: 2,
    title: 'Banana Bread',
    description: null,
    content: '## Ingredients\n- Bananas\n- Flour',
    createdAt: '2024-01-02T10:00:00',
    updatedAt: '2024-01-02T10:00:00',
  },
];

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

  it('getAll() should fetch recipes and update recipeCount signal', () => {
    let result: Recipe[] | undefined;
    service.getAll().subscribe((r) => (result = r));

    const req = httpMock.expectOne((r) => r.url.includes('/recipes'));
    req.flush(mockRecipes);

    expect(result).toEqual(mockRecipes);
    expect(service.recipeCount()).toBe(2);
    expect(service.hasRecipes()).toBe(true);
  });

  it('delete() should decrement recipeCount signal', () => {
    // Seed the count
    service.getAll().subscribe();
    httpMock.expectOne((r) => r.url.includes('/recipes')).flush(mockRecipes);
    expect(service.recipeCount()).toBe(2);

    service.delete(1).subscribe();
    httpMock.expectOne((r) => r.url.includes('/recipes/1')).flush(null);
    expect(service.recipeCount()).toBe(1);
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
