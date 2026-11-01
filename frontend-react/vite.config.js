import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  // El JSX de las pruebas lo compila el transformador suelto de Vite, no el
  // plugin de React, y sin esto lo convierte a React.createElement: las
  // pruebas reventaban con "React is not defined" mientras la aplicacion
  // compilaba bien.
  //
  // Solo en modo test. Vite 8 compila con oxc y no con esbuild, asi que al
  // compilar para publicar esta opcion no se aplica y avisaba de ello en
  // cada build: un aviso que no significaba nada y que ensuciaba tambien la
  // salida de las pruebas de extremo a extremo, que compilan antes de correr.
  ...(mode === 'test' ? { esbuild: { jsx: 'automatic' } } : {}),

  test: {
    // jsdom y no el navegador de verdad: estas pruebas miran lo que dibuja
    // React y como reacciona, no como lo pinta el motor. Lo que si necesita un
    // navegador de verdad -que el CSS esconda la tabla en movil, que el QR se
    // descargue- esta en pruebas-e2e/.
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/pruebas/preparar.js',
    css: false,

    // Las de extremo a extremo son de Playwright y no de Vitest: sin esto,
    // Vitest encontraria sus archivos .spec.js, los cargaria sin navegador y
    // fallarian todas.
    exclude: ['pruebas-e2e/**', 'node_modules/**', 'dist/**', 'dist-e2e/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{js,jsx}'],
      // main.jsx solo monta la aplicacion y los .css no tienen nada que probar
      exclude: ['src/main.jsx', 'src/pruebas/**']
    }
  }
}))
