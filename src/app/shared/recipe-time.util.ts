import { Recipe } from '../models/recipe.model';

/**
 * Sums prep + cook time. Both null means "unknown" (renders nothing);
 * a single null is treated as 0 so a recipe with only one time set still
 * gets a meaningful total.
 */
export function totalTimeMinutes(
  recipe: Pick<Recipe, 'prepTimeMinutes' | 'cookTimeMinutes'>,
): number | null {
  const prep = recipe.prepTimeMinutes ?? null;
  const cook = recipe.cookTimeMinutes ?? null;
  if (prep === null && cook === null) {
    return null;
  }
  return (prep ?? 0) + (cook ?? 0);
}
