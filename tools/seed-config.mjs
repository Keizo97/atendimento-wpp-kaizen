// Le o arquivo "Prompt para yumi.txt" e joga dentro de yumiwpp_config.system_prompt.
// Rodar sempre que voce editar o .txt e quiser mandar pro banco.
//
// Uso:  node tools/seed-config.mjs
//
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local

import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const ARQUIVO_PROMPT = 'Prompt para yumi.txt'

// Carrega o .env.local sem depender de pacote externo
async function carregarEnv() {
  let conteudo
  try {
    conteudo = await readFile('.env.local', 'utf8')
  } catch {
    return
  }
  for (const linha of conteudo.split('\n')) {
    const limpa = linha.trim()
    if (!limpa || limpa.startsWith('#')) continue
    const igual = limpa.indexOf('=')
    if (igual === -1) continue
    const chave = limpa.slice(0, igual).trim()
    const valor = limpa.slice(igual + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[chave]) process.env[chave] = valor
  }
}

await carregarEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Falta NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY no .env.local')
  process.exit(1)
}

let prompt
try {
  prompt = (await readFile(ARQUIVO_PROMPT, 'utf8')).trim()
} catch {
  console.error(`Arquivo "${ARQUIVO_PROMPT}" nao encontrado na raiz do projeto.`)
  process.exit(1)
}

if (!prompt) {
  console.error(`Arquivo "${ARQUIVO_PROMPT}" esta vazio. Cole o system prompt nele e rode de novo.`)
  process.exit(1)
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

const { error } = await supabase
  .from('yumiwpp_config')
  .upsert({ id: 1, system_prompt: prompt }, { onConflict: 'id' })

if (error) {
  console.error('Erro ao gravar no Supabase:', error.message)
  process.exit(1)
}

console.log(`OK. system_prompt atualizado (${prompt.length} caracteres).`)
