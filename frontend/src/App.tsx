import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { NaoEncontrada } from './nao-encontrada'
import { PaginaContratar } from './pagina-contratar'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/contratar" element={<PaginaContratar />} />
        <Route path="*" element={<NaoEncontrada />} />
      </Routes>
    </BrowserRouter>
  )
}
