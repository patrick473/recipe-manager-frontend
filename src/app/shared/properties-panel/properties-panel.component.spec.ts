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
});
