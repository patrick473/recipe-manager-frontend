import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IngredientDto } from '../../api/generated/model/ingredientDto';
import { IngredientEditorComponent } from './ingredient-editor.component';

describe('IngredientEditorComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('adds, removes, and preserves reordered values', () => {
    const fixture = TestBed.createComponent(IngredientEditorComponent);
    const component = fixture.componentInstance;
    const changed = vi.fn<(value: IngredientDto[]) => void>();
    component.registerOnChange(changed);
    component.writeValue([{ name: 'flour' }, { name: 'salt' }]);

    component['move'](1, -1);
    expect(changed).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'salt' }),
      expect.objectContaining({ name: 'flour' }),
    ]);

    component['add']();
    expect(component['rows'].length).toBe(3);
    component['remove'](2);
    expect(component['rows'].length).toBe(2);
  });

  it('toggles and validates quantity ranges', () => {
    const fixture = TestBed.createComponent(IngredientEditorComponent);
    const component = fixture.componentInstance;
    component.writeValue([{ quantity: 3, name: 'garlic' }]);

    component['toggleRange'](0, true);
    component['rows'].at(0).controls.quantityMax.setValue(2);

    expect(component.validate(component['rows'])).toEqual({ ingredients: true });
    expect(component['rows'].at(0).errors).toEqual({ quantityRange: true });

    component['rows'].at(0).controls.quantityMax.setValue(4);
    expect(component.validate(component['rows'])).toBeNull();
  });

  it('requires an ingredient name', () => {
    const fixture = TestBed.createComponent(IngredientEditorComponent);
    const component = fixture.componentInstance;
    component.writeValue([]);

    expect(component.validate(component['rows'])).toEqual({ ingredients: true });
  });
});