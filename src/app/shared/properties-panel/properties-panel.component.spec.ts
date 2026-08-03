import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { PropertiesPanelComponent } from './properties-panel.component';

describe('PropertiesPanelComponent', () => {
  let fixture: ComponentFixture<PropertiesPanelComponent>;
  let component: PropertiesPanelComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PropertiesPanelComponent],
    });

    fixture = TestBed.createComponent(PropertiesPanelComponent);
    component = fixture.componentInstance;
    // Give the panel something to show, since read-only .properties-body is
    // gated behind hasAnyValue() as well as expanded().
    fixture.componentRef.setInput('tags', ['quick']);
    fixture.detectChanges();
  });

  it('expand() sets expanded to true and shows .properties-body even when collapsed', () => {
    // expanded() defaults to true — collapse it first so this test starts
    // from the collapsed state expand() is meant to recover from.
    component['toggleExpanded']();
    fixture.detectChanges();

    expect(component['expanded']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.properties-body')).toBeNull();

    component.expand();
    fixture.detectChanges();

    expect(component['expanded']()).toBe(true);
    expect(fixture.nativeElement.querySelector('.properties-body')).toBeTruthy();
  });

  describe('adding tags via the tag input', () => {
    let tagInput: HTMLInputElement;

    beforeEach(() => {
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();
      tagInput = fixture.nativeElement.querySelector('.tag-input') as HTMLInputElement;
    });

    function typeAndPressKey(text: string, key: string): void {
      tagInput.value = text;
      tagInput.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      tagInput.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
      fixture.detectChanges();
    }

    it('trims whitespace and emits the new tag list on Enter', () => {
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      typeAndPressKey('  vegan  ', 'Enter');

      expect(emitted).toEqual(['quick', 'vegan']);
    });

    it('also adds a tag on comma', () => {
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      typeAndPressKey('vegan', ',');

      expect(emitted).toEqual(['quick', 'vegan']);
    });

    it('clears the input text after adding a tag', () => {
      typeAndPressKey('vegan', 'Enter');

      expect(component['newTagText']()).toBe('');
    });

    it('does not emit for an empty or whitespace-only tag', () => {
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      typeAndPressKey('   ', 'Enter');

      expect(emitted).toBeUndefined();
    });

    it('does not emit a duplicate of an existing tag', () => {
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      typeAndPressKey('quick', 'Enter');

      expect(emitted).toBeUndefined();
    });

    it('does not add a tag once MAX_TAGS (20) is reached', () => {
      const twentyTags = Array.from({ length: 20 }, (_, i) => `tag-${i}`);
      fixture.componentRef.setInput('tags', twentyTags);
      fixture.detectChanges();
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      typeAndPressKey('one-too-many', 'Enter');

      expect(emitted).toBeUndefined();
    });

    it('is a no-op for keys other than Enter or comma', () => {
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      typeAndPressKey('vegan', 'a');

      expect(emitted).toBeUndefined();
      expect(component['newTagText']()).toBe('vegan');
    });
  });

  describe('removing a tag', () => {
    it('emits the tag list without the removed tag when its remove button is clicked', () => {
      fixture.componentRef.setInput('tags', ['quick', 'vegan']);
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();
      let emitted: string[] | undefined;
      component.tagsChange.subscribe((tags) => (emitted = tags));

      const removeButton = fixture.nativeElement.querySelector(
        '.tag-chip-remove',
      ) as HTMLButtonElement;
      removeButton.click();

      expect(emitted).toEqual(['vegan']);
    });
  });

  describe('filteredSuggestions', () => {
    it('excludes tags already applied to the recipe', () => {
      fixture.componentRef.setInput('tags', ['quick', 'vegan']);
      fixture.componentRef.setInput('tagSuggestions', ['quick', 'vegan', 'dessert', 'spicy']);
      fixture.detectChanges();

      expect(component['filteredSuggestions']()).toEqual(['dessert', 'spicy']);
    });

    it('returns all suggestions when none are already applied', () => {
      fixture.componentRef.setInput('tags', []);
      fixture.componentRef.setInput('tagSuggestions', ['dessert', 'spicy']);
      fixture.detectChanges();

      expect(component['filteredSuggestions']()).toEqual(['dessert', 'spicy']);
    });
  });

  describe('numeric property inputs', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('editable', true);
      fixture.detectChanges();
    });

    function inputFor(label: string): HTMLInputElement {
      const rows = Array.from(
        fixture.nativeElement.querySelectorAll('.properties-row'),
      ) as HTMLElement[];
      const row = rows.find((r) => r.querySelector('.properties-label')?.textContent === label);
      return row!.querySelector('.properties-number-input') as HTMLInputElement;
    }

    it('emits a parsed number when a numeric prep time is entered', () => {
      let emitted: number | null | undefined;
      component.prepTimeMinutesChange.subscribe((v) => (emitted = v));
      const input = inputFor('Prep time');

      input.value = '15';
      input.dispatchEvent(new Event('input'));

      expect(emitted).toBe(15);
    });

    it('emits null, not NaN, when the cook time input is cleared to an empty string', () => {
      let emitted: number | null | undefined;
      component.cookTimeMinutesChange.subscribe((v) => (emitted = v));
      const input = inputFor('Cook time');

      input.value = '';
      input.dispatchEvent(new Event('input'));

      expect(emitted).toBeNull();
    });

    it('emits null, not NaN, when servings is non-numeric', () => {
      let emitted: number | null | undefined;
      component.servingsChange.subscribe((v) => (emitted = v));
      const input = inputFor('Servings');

      input.value = 'abc';
      input.dispatchEvent(new Event('input'));

      expect(emitted).toBeNull();
    });

    it('emits null, not NaN, for a non-numeric value that bypasses <input type="number"> sanitization', () => {
      // A real <input type="number"> silently resets an invalid string like
      // "12abc" back to "", which only exercises the empty-string branch.
      // Call the handler directly with a synthetic event to exercise
      // Number.isNaN(n) actually seeing a non-empty, non-numeric value.
      let emitted: number | null | undefined;
      component.servingsChange.subscribe((v) => (emitted = v));
      const fakeEvent = { target: { value: '12abc' } } as unknown as Event;

      component['onServingsInput'](fakeEvent);

      expect(emitted).toBeNull();
    });
  });
});
