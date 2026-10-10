const environment = typeof import.meta.env === 'object' ? import.meta.env : {}

export const BRAND = {
  name: environment.VITE_APP_NAME || 'Carvalho',
  mark: environment.VITE_APP_MARK || (environment.VITE_APP_NAME || 'Carvalho').slice(0, 1).toUpperCase(),
  palette: {
    primary: {
      50: '#f3f5f9',
      100: '#e6eaf1',
      200: '#cbd3e0',
      300: '#a4b1c8',
      400: '#788aa9',
      500: '#526988',
      600: '#12284d',
      700: '#0f2242',
      800: '#0c1c36',
      900: '#091529',
    },
    secondary: '#cca761',
    accent: '#cca761',
    white: '#ffffff',
  },
}
