import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

// Aura preset, slate-tinted, with the dark-mode selector matching Tailwind's
// default `.dark` class so a single toggle controls both systems.
export const TunePreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{slate.50}',
      100: '{slate.100}',
      200: '{slate.200}',
      300: '{slate.300}',
      400: '{slate.400}',
      500: '{slate.500}',
      600: '{slate.600}',
      700: '{slate.700}',
      800: '{slate.800}',
      900: '{slate.900}',
      950: '{slate.950}',
    },
  },
})

export const primevueOptions = {
  theme: {
    preset: TunePreset,
    options: {
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        // Tailwind utilities live in the `utilities` layer; keeping PrimeVue
        // in its own layer below `utilities` lets Tailwind classes win.
        order: 'theme, base, primevue, utilities',
      },
    },
  },
  ripple: false,
}
