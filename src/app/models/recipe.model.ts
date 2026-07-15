/**
 * Matches the RecipeResponse DTO returned by the Spring Boot API.
 */
export interface Recipe {
  id: number;
  title: string;
  description: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Matches the RecipeRequest DTO accepted by POST /recipes and PUT /recipes/{id}.
 */
export interface RecipeRequest {
  title: string;
  description?: string | null;
  content: string;
}
