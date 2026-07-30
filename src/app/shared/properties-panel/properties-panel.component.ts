import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/** Backend enforces @Size(max = 20) on RecipeRequest.tags — mirrored here client-side. */
const MAX_TAGS = 20;

let nextInstanceId = 0;

/**
 * Obsidian-style "Properties" panel for a recipe's structured metadata
 * (tags, prep/cook time, servings).
 *
 * Purely presentational — plain signal inputs/outputs, no ControlValueAccessor —
 * so it can be used both from a reactive form (`RecipeFormComponent`, editable)
 * and from a read-only detail view (`RecipeDetailComponent`).
 */
@Component({
  selector: 'app-properties-panel',
  imports: [IconComponent],
  templateUrl: './properties-panel.component.html',
  styleUrl: './properties-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  readonly tags = input<string[]>([]);
  readonly prepTimeMinutes = input<number | null>(null);
  readonly cookTimeMinutes = input<number | null>(null);
  readonly servings = input<number | null>(null);
  readonly editable = input(false);
  /** Candidate tags for autocomplete — caller computes this across all recipes. */
  readonly tagSuggestions = input<string[]>([]);

  readonly tagsChange = output<string[]>();
  readonly prepTimeMinutesChange = output<number | null>();
  readonly cookTimeMinutesChange = output<number | null>();
  readonly servingsChange = output<number | null>();

  protected readonly expanded = signal(true);
  protected readonly newTagText = signal('');

  /** Unique per instance so the tag-suggestions <datalist> id never collides. */
  protected readonly tagSuggestionsListId = `properties-panel-tags-${nextInstanceId++}`;

  /** Suggestions not already applied to this recipe. */
  protected readonly filteredSuggestions = computed(() => {
    const current = this.tags();
    return this.tagSuggestions().filter((s) => !current.includes(s));
  });

  /** Whether there's anything at all to show in read-only mode. */
  protected readonly hasAnyValue = computed(
    () =>
      this.tags().length > 0 ||
      this.prepTimeMinutes() !== null ||
      this.cookTimeMinutes() !== null ||
      this.servings() !== null,
  );

  protected toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }

  /** Forces the panel open — used by RecipeDetailComponent before printing. */
  expand(): void {
    this.expanded.set(true);
  }

  protected removeTag(tag: string): void {
    this.tagsChange.emit(this.tags().filter((t) => t !== tag));
  }

  protected onNewTagInput(event: Event): void {
    this.newTagText.set((event.target as HTMLInputElement).value);
  }

  /** Adds on Enter or comma; both are prevented from being typed into the field. */
  protected onNewTagKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      this.addTag(this.newTagText());
      this.newTagText.set('');
    }
  }

  private addTag(raw: string): void {
    const value = raw.trim();
    if (!value) return;

    const current = this.tags();
    if (current.length >= MAX_TAGS || current.includes(value)) return;

    this.tagsChange.emit([...current, value]);
  }

  protected onPrepTimeInput(event: Event): void {
    this.prepTimeMinutesChange.emit(this.parseNumberInput(event));
  }

  protected onCookTimeInput(event: Event): void {
    this.cookTimeMinutesChange.emit(this.parseNumberInput(event));
  }

  protected onServingsInput(event: Event): void {
    this.servingsChange.emit(this.parseNumberInput(event));
  }

  private parseNumberInput(event: Event): number | null {
    const value = (event.target as HTMLInputElement).value;
    if (value.trim() === '') return null;
    const n = Number(value);
    return Number.isNaN(n) ? null : n;
  }
}
