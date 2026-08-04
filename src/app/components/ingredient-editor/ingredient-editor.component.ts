import { ChangeDetectionStrategy, Component, forwardRef, inject } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { IngredientDto } from '../../api/generated/model/ingredientDto';
import { ButtonDirective } from '../../shared/button.directive';
import { IconComponent } from '../../shared/icon/icon.component';

type IngredientRow = FormGroup<{
  quantity: FormControl<number | null>;
  quantityMax: FormControl<number | null>;
  unit: FormControl<string>;
  name: FormControl<string>;
  note: FormControl<string>;
}>;

@Component({
  selector: 'app-ingredient-editor',
  imports: [ReactiveFormsModule, ButtonDirective, IconComponent],
  templateUrl: './ingredient-editor.component.html',
  styleUrl: './ingredient-editor.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => IngredientEditorComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => IngredientEditorComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngredientEditorComponent implements ControlValueAccessor, Validator {
  private readonly fb = inject(FormBuilder);
  private onChange: (value: IngredientDto[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private onValidatorChange: () => void = () => undefined;
  private draggedIndex: number | null = null;

  protected readonly rows = new FormArray<IngredientRow>([]);
  protected readonly unitSuggestions = [
    'cup',
    'tbsp',
    'tsp',
    'g',
    'kg',
    'ml',
    'l',
    'oz',
    'lb',
    'clove',
    'slice',
    'packet',
  ];

  constructor() {
    this.rows.valueChanges.subscribe(() => {
      this.onChange(this.toValue());
      this.onValidatorChange();
    });
  }

  writeValue(value: IngredientDto[] | null): void {
    this.rows.clear({ emitEvent: false });
    (value?.length ? value : [this.emptyValue()]).forEach((ingredient) =>
      this.rows.push(this.createRow(ingredient), { emitEvent: false }),
    );
    this.onValidatorChange();
  }

  registerOnChange(fn: (value: IngredientDto[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  setDisabledState(disabled: boolean): void {
    disabled ? this.rows.disable({ emitEvent: false }) : this.rows.enable({ emitEvent: false });
  }

  validate(_control: AbstractControl): ValidationErrors | null {
    return this.rows.length >= 1 && this.rows.length <= 100 && this.rows.valid
      ? null
      : { ingredients: true };
  }

  protected add(): void {
    this.rows.push(this.createRow(this.emptyValue()));
  }

  protected remove(index: number): void {
    this.rows.removeAt(index);
    this.onTouched();
  }

  protected move(index: number, offset: number): void {
    const target = index + offset;
    if (target < 0 || target >= this.rows.length) return;
    const row = this.rows.at(index);
    this.rows.removeAt(index, { emitEvent: false });
    this.rows.insert(target, row);
    this.emitValue();
  }

  protected toggleRange(index: number, enabled: boolean): void {
    const control = this.rows.at(index).controls.quantityMax;
    if (enabled) {
      control.enable();
    } else {
      control.setValue(null);
      control.disable();
    }
  }

  protected onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  protected onDrop(index: number): void {
    if (this.draggedIndex !== null && this.draggedIndex !== index) {
      this.move(this.draggedIndex, index - this.draggedIndex);
    }
    this.draggedIndex = null;
  }

  protected markTouched(): void {
    this.onTouched();
  }

  private createRow(value: IngredientDto): IngredientRow {
    const quantityMax = this.fb.control<number | null>(value.quantityMax ?? null, [
      Validators.min(Number.MIN_VALUE),
    ]);
    if (value.quantityMax == null) quantityMax.disable({ emitEvent: false });

    const row = this.fb.group({
      quantity: this.fb.control<number | null>(value.quantity ?? null, [
        Validators.min(Number.MIN_VALUE),
      ]),
      quantityMax,
      unit: this.fb.nonNullable.control(value.unit ?? '', Validators.maxLength(30)),
      name: this.fb.nonNullable.control(value.name, [
        Validators.required,
        Validators.maxLength(255),
      ]),
      note: this.fb.nonNullable.control(value.note ?? '', Validators.maxLength(255)),
    });
    row.addValidators((control) => {
      const start = control.get('quantity')?.value;
      const end = control.get('quantityMax')?.value;
      return start != null && end != null && end < start ? { quantityRange: true } : null;
    });
    return row;
  }

  private toValue(): IngredientDto[] {
    return this.rows.getRawValue().map((row) => ({
      quantity: row.quantity,
      quantityMax: row.quantityMax,
      unit: row.unit || null,
      name: row.name,
      note: row.note || null,
    }));
  }

  private emitValue(): void {
    this.onChange(this.toValue());
    this.onValidatorChange();
    this.onTouched();
  }

  private emptyValue(): IngredientDto {
    return { name: '' };
  }
}