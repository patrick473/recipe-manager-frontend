import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';

export type IconName =
  | 'chef-hat'
  | 'plus'
  | 'pencil'
  | 'trash'
  | 'sun'
  | 'moon'
  | 'menu'
  | 'list'
  | 'chevron-left'
  | 'chevron-right';

// Material Icons font ligature names — the font renders these text strings as glyphs.
const MATERIAL_ICON_LIGATURES: Record<IconName, string> = {
  'chef-hat': 'restaurant_menu',
  plus: 'add',
  pencil: 'edit',
  trash: 'delete',
  sun: 'wb_sunny',
  moon: 'nights_stay',
  menu: 'menu',
  list: 'format_list_bulleted',
  'chevron-left': 'chevron_left',
  'chevron-right': 'chevron_right',
};

@Component({
  selector: 'app-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss',
})
export class IconComponent {
  readonly name = input.required<IconName>();
  readonly size = input(18);

  protected readonly ligature = computed(() => MATERIAL_ICON_LIGATURES[this.name()]);
}
