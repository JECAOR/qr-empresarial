import Encabezado from "./components/Encabezado/Encabezado";
import PerfilPublicoPage from "./pages/PerfilPublico/PerfilPublicoPage";

function App() {
  return (
    <>
      <Encabezado
        titulo="QR Empresarial"
        subtitulo="Lo que ve quien escanea el código"
      />
      <PerfilPublicoPage />
    </>
  );
}

export default App;
