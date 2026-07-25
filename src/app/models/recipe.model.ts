import type { RecipeResponse } from '../api/generated/model';

/**
 * Matches the RecipeResponse DTO returned by the Spring Boot API.
 * Generated from openapi.yaml via Orval — see src/app/api/generated.
 */
export type Recipe = RecipeResponse;

/**
 * Matches the RecipeRequest DTO accepted by POST /recipes and PUT /recipes/{id}.
 * Generated from openapi.yaml via Orval — see src/app/api/generated.
 */
export type { RecipeRequest } from '../api/generated/model';
