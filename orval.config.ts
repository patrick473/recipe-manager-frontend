import { defineConfig } from 'orval';

export default defineConfig({
  recipeManager: {
    input: {
      target: '../recipe-manager-backend/openapi.yaml',
    },
    output: {
      mode: 'tags-split',
      target: 'src/app/api/generated/recipe-manager.ts',
      schemas: 'src/app/api/generated/model',
      client: 'angular',
      mock: false,
    },
  },
});
