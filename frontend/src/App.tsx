import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PaginaConsulta } from './consulta/pagina-consulta'
import { NaoEncontrada } from './nao-encontrada'
import { PaginaContratar } from './pagina-contratar'
import { PaginaMedico } from './medico/pagina-medico'
import { PaginaInicialModulo } from './modulo/pagina-inicial'
import { JanelaProntuario } from './prontuario/janela-prontuario'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/contratar" element={<PaginaContratar />} />
        <Route path="/medico/:slug" element={<PaginaMedico />} />
        <Route path="/modulo/:slug" element={<PaginaInicialModulo />} />
        <Route path="/modulo/:slug/consulta/:atendimento/:etapa" element={<PaginaConsulta />} />
        <Route path="/modulo/:slug/prontuario/:paciente" element={<JanelaProntuario />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </BrowserRouter>
  )
}
