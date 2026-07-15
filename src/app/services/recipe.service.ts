import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Recipe, RecipeRequest } from '../models/recipe.model';
import { environment } from '../../environments/environment';

/**
 * Service that wraps all five Recipe Manager API endpoints.
 *
 * Inject this service into components that need to read or modify recipes.
 * Every method returns an Observable; subscribe (or use the async pipe) in
 * the component.
 */
@Injectable({ providedIn: 'root' })
export class RecipeService {
  private readonly apiUrl = `${environment.apiUrl}/recipes`;

  constructor(private http: HttpClient) {}

  /** GET /recipes — list all recipes */
  getAll(): Observable<Recipe[]> {
    return this.http.get<Recipe[]>(this.apiUrl);
  }

  /** GET /recipes/{id} — get a single recipe */
  getById(id: number): Observable<Recipe> {
    return this.http.get<Recipe>(`${this.apiUrl}/${id}`);
  }

  /** POST /recipes — create a new recipe */
  create(request: RecipeRequest): Observable<Recipe> {
    return this.http.post<Recipe>(this.apiUrl, request);
  }

  /** PUT /recipes/{id} — update an existing recipe */
  update(id: number, request: RecipeRequest): Observable<Recipe> {
    return this.http.put<Recipe>(`${this.apiUrl}/${id}`, request);
  }

  /** DELETE /recipes/{id} — delete a recipe */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
