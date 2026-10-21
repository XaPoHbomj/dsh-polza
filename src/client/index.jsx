/**
 * Polza browser half: a footer balance chip, a sidebar panel entry, and the
 * full statistics page registered into the layout's `main` seat.
 */
import { BalanceChip, PolzaPanel, PolzaPanelIcon } from './PolzaPanel.jsx'
import { PolzaSettings } from './PolzaSettings.jsx'
import { ensureStyles } from './styles.js'

export const name = 'dsh-polza'
export const inject = ['slots', 'layout', 'configForms']

const PANEL_ID = 'polza'

/** Register the panel, its sidebar entry, and the always-visible chip. */
export function apply(ctx) {
  ensureStyles()

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
  }, PolzaPanel))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 40,
    label: () => 'Polza',
  }, PolzaPanelIcon))

  ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
    name: 'plugins.bundle.config',
    key: 'dsh-polza',
    inject: () => ({ injectedForm: ctx.configForms.get('polza') }),
  }, PolzaSettings))

  ctx.slots.inject('plugins.row.config', () => ctx.slots.register({
    name: 'plugins.row.config',
    key: 'dsh-polza#polza',
    inject: () => ({ injectedForm: ctx.configForms.get('polza') }),
  }, PolzaSettings))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'polza-balance',
  }, props => (
    <BalanceChip
      wide={props.wide !== false}
      openPanel={() => ctx.layout.selectPanel(PANEL_ID)}
    />
  )))
}
