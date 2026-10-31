import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // El JSX de las pruebas lo compila esbuild, no el plugin de React, y sin
  // esto lo convierte a React.createElement: las pruebas reventaban con
  // "React is not defined" mientras la aplicacion compilaba bien.
  esbuild: { jsx: 'automatic' },

  test: {
    // jsdom y no el navegador de verdad: estas pruebas miran lo que dibuja
    // React y como reacciona, no como lo pinta el motor. Lo que si necesita un
    // navegador de verdad -que el CSS esconda la tabla en movil, que el QR se
    // descargue- esta en las pruebas de extremo a extremo.
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/pruebas/preparar.js',
    css: false,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      // main.jsx solo monta la aplicacion y los .css no tienen nada que probar
      exclude: ['src/main.jsx', 'src/pruebas/**']
    }
  }
})
