import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { NaoEncontrada } from './nao-encontrada'
import { PaginaContratar } from './pagina-contratar'
import { PaginaMedico } from './medico/pagina-medico'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/contratar" element={<PaginaContratar />} />
        <Route path="/medico/:slug" element={<PaginaMedico />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </BrowserRouter>
  )
}
