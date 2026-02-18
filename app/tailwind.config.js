/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Category colors
        productivity: '#3D85C6',
        health: '#6AA84F',
        growth: '#8E7CC3',
        vice: '#CC4125',

        // Score gradient stops
        score: {
          low: '#CC4125',
          mid: '#FFD966',
          high: '#6AA84F',
        },

        // Structural colors
        surface: {
          dark: '#1F2937',
          kpi: '#F0F4F8',
          good: '#D5F5E3',
          vice: '#FADBD8',
          inactive: '#F8F9FA',
        },

        // Streak
        streak: {
          gold: '#FFD700',
        },
      },
      spacing: {
        // Base unit is 4px — Tailwind's default scale already uses 4px increments
        // These are custom named tokens for component-level consistency
        'component': '16px',  // Component padding
        'section': '24px',    // Section gap
        'card': '12px',       // Card gap
      },
      fontSize: {
        'kpi-value': ['20px', { fontWeight: '700' }],
        'kpi-label': ['11px', { fontWeight: '400' }],
        'section-header': ['13px', { fontWeight: '600' }],
        'body': ['14px', { fontWeight: '400' }],
        'subdued': ['12px', { fontWeight: '400' }],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
