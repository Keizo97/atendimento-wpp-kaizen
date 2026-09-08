// Debounce por telefone: agrupa mensagens que chegam em sequencia rapida
// (cliente mandando varias bolhas seguidas) numa unica resposta da IA, em
// vez de responder a cada webhook isolado.
//
// So funciona com 1 instancia do container rodando — o timer fica em
// memoria do processo Node. Deploy atual e Coolify/Docker com container
// unico, entao ok. Se um dia escalar horizontal (mais de 1 instancia),
// isso precisa virar fila/lock no banco.
import 'server-only'

const timers = new Map<string, NodeJS.Timeout>()

const DELAY_MS = Number(process.env.YUMI_BUFFER_MS) || 8000

// Reagenda a execucao pro telefone: se ja tinha um timer pendente (cliente
// mandou outra mensagem antes do anterior disparar), cancela e comeca de
// novo. So executa quando passar DELAY_MS sem nova chamada pro mesmo numero.
export function agendarResposta(telefone: string, executar: () => Promise<void>): void {
  const timerAnterior = timers.get(telefone)
  if (timerAnterior) clearTimeout(timerAnterior)

  const timer = setTimeout(() => {
    timers.delete(telefone)
    executar().catch((erro) => {
      console.error('[buffer] erro ao processar resposta agendada:', erro)
    })
  }, DELAY_MS)

  timers.set(telefone, timer)
}
