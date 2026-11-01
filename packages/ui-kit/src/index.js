// @grosh/ui-kit — iOS-нативный UI-kit для веба на Preact.
// Стили подключаются отдельно: import '@grosh/ui-kit/styles.css'

export { ConfigProvider, useConfig, useLabels, defaultConfig, defaultLabels } from './config.js';
export { ThemeProvider, useTheme } from './theme.js';
export { useReducedMotion, isReducedMotion, useCountUp } from './motion.js';
export { haptic } from './haptics.js';

export { Icon, Sq, Chevron, Tag, Count, Spinner, Progress, Ring, Badge, Avatar } from './components/primitives.js';
export { Seg, Switch, Check, Stepper, Capsule, Slider } from './components/controls.js';
export { Popover, Select, Menu, Calendar, DatePicker, Wheel, TimePicker } from './components/pickers.js';
export { Field, SearchField } from './components/forms.js';
export { Screen, Page, Section } from './components/layout.js';
export { Sheet, SheetNav, Dialog, Island } from './components/overlays.js';
export { Banner, Empty, Confetti } from './components/feedback.js';
export { Passcode } from './components/passcode.js';
