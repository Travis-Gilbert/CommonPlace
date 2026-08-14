/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
    colors: {
        primary: {
            '50': 'hsl(144, 100%, 97%)',
            '100': 'hsl(144, 100%, 94%)',
            '200': 'hsl(144, 100%, 86%)',
            '300': 'hsl(144, 100%, 76%)',
            '400': 'hsl(144, 100%, 64%)',
            '500': 'hsl(144, 100%, 50%)',
            '600': 'hsl(144, 100%, 40%)',
            '700': 'hsl(144, 100%, 32%)',
            '800': 'hsl(144, 100%, 24%)',
            '900': 'hsl(144, 100%, 16%)',
            '950': 'hsl(144, 100%, 10%)',
            DEFAULT: '#008134'
        },
        'neutral-50': '#000000',
        'neutral-100': '#c8c8c8',
        'neutral-200': '#ffffff',
        'neutral-300': '#e9e9e9',
        'neutral-400': '#242424',
        'neutral-500': '#f4f4f4',
        background: '#ffffff',
        foreground: '#000000'
    },
    fontFamily: {
        sans: [
            'Inter',
            'sans-serif'
        ],
        body: [
            'ui-monospace',
            'sans-serif'
        ]
    },
    fontSize: {
        '10': [
            '10px',
            {
                lineHeight: '12.5px'
            }
        ],
        '11': [
            '11px',
            {
                lineHeight: '16px',
                letterSpacing: '1.1px'
            }
        ],
        '12': [
            '12px',
            {
                lineHeight: '16px'
            }
        ],
        '13': [
            '13px',
            {
                lineHeight: '19.5px',
                letterSpacing: '1.82px'
            }
        ],
        '14': [
            '14px',
            {
                lineHeight: '20px'
            }
        ],
        '16': [
            '16px',
            {
                lineHeight: '24px'
            }
        ],
        '18': [
            '18px',
            {
                lineHeight: '29.25px'
            }
        ],
        '20': [
            '20px',
            {
                lineHeight: '27.5px',
                letterSpacing: '-0.5px'
            }
        ],
        '24': [
            '24px',
            {
                lineHeight: '32px',
                letterSpacing: '-0.6px'
            }
        ],
        '36': [
            '36px',
            {
                lineHeight: '40px',
                letterSpacing: '-0.9px'
            }
        ],
        '48': [
            '48px',
            {
                lineHeight: '52.8px',
                letterSpacing: '-1.2px'
            }
        ]
    },
    spacing: {
        '32': '64px',
        '48': '96px',
        '72': '144px',
        '104': '208px',
        '128': '256px',
        '146': '292px',
        '157': '314px',
        '171': '342px',
        '183': '366px',
        '1px': '1px',
        '231px': '231px',
        '451px': '451px'
    },
    borderRadius: {
        sm: '4px',
        md: '8px',
        lg: '14px',
        full: '9999px'
    },
    boxShadow: {
        sm: 'rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px, rgba(0, 0, 0, 0.18) 0px 10px 22px -6px'
    },
    transitionDuration: {
        '150': '0.15s',
        '200': '0.2s',
        '300': '0.3s',
        '1100': '1.1s'
    },
    transitionTimingFunction: {
        custom: 'cubic-bezier(0, 0, 0.2, 1)'
    },
    container: {
        center: true,
        padding: '24px'
    },
    maxWidth: {
        container: '1400px'
    }
},
  },
};
