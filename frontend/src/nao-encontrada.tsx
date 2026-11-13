import { Moldura } from './moldura'

export function NaoEncontrada() {
  return (
    <Moldura>
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <h1 className="text-[clamp(32px,4vw,48px)] font-semibold">Página não encontrada.</h1>
        <p className="mt-4 text-lg text-apagado">O endereço pode ter mudado.</p>
        <a href="/" className="mt-8 inline-block bg-petroleo px-6 py-4 font-bold text-papel">Voltar ao início</a>
      </section>
    </Moldura>
  )
}
