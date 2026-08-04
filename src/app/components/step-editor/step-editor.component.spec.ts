import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeStepDto } from '../../api/generated/model/recipeStepDto';
import { StepEditorComponent } from './step-editor.component';

describe('StepEditorComponent', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('moves steps and emits their new order', () => {
    const fixture = TestBed.createComponent(StepEditorComponent);
    const component = fixture.componentInstance;
    const changed = vi.fn<(value: RecipeStepDto[]) => void>();
    component.registerOnChange(changed);
    component.writeValue([{ instruction: 'Mix.' }, { instruction: 'Bake.' }]);

    component['move'](1, -1);

    expect(changed).toHaveBeenLastCalledWith([
      { instruction: 'Bake.' },
      { instruction: 'Mix.' },
    ]);
  });

  it('Enter on a populated step adds the next row while Shift+Enter remains multiline', () => {
    const fixture = TestBed.createComponent(StepEditorComponent);
    const component = fixture.componentInstance;
    component.writeValue([{ instruction: 'Mix.' }]);
    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });

    component['onKeydown'](enter, 0);
    expect(enter.defaultPrevented).toBe(true);
    expect(component['rows'].length).toBe(2);

    const shiftEnter = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
    component['onKeydown'](shiftEnter, 0);
    expect(shiftEnter.defaultPrevented).toBe(false);
    expect(component['rows'].length).toBe(2);
  });

  it('requires a nonblank instruction', () => {
    const fixture = TestBed.createComponent(StepEditorComponent);
    const component = fixture.componentInstance;
    component.writeValue([]);

    expect(component.validate(component['rows'])).toEqual({ steps: true });
  });
});