// Le "Prompt para yumi.txt" e "Base de conhecimento yumi.txt" e joga dentro
// de yumiwpp_config (system_prompt e knowledge_base).
// Rodar sempre que voce editar os .txt e quiser mandar pro banco.
//
// Uso:  node tools/seed-config.mjs
//
// Precisa de NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local

import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const ARQUIVO_PROMPT = 'Prompt para yumi.txt'
const ARQUIVO_KB = 'Base de conhecimento yumi.txt'

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

// Base de conhecimento e opcional: se o arquivo nao existir, so nao mexe nesse campo.
let knowledgeBase
try {
  knowledgeBase = (await readFile(ARQUIVO_KB, 'utf8')).trim()
} catch {
  knowledgeBase = null
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
})

const dados = { id: 1, system_prompt: prompt }
if (knowledgeBase !== null) dados.knowledge_base = knowledgeBase

const { error } = await supabase.from('yumiwpp_config').upsert(dados, { onConflict: 'id' })

if (error) {
  console.error('Erro ao gravar no Supabase:', error.message)
  process.exit(1)
}

console.log(`OK. system_prompt atualizado (${prompt.length} caracteres).`)
if (knowledgeBase !== null) {
  console.log(`OK. knowledge_base atualizada (${knowledgeBase.length} caracteres).`)
} else {
  console.log(`(${ARQUIVO_KB} nao encontrado — knowledge_base nao foi alterada.)`)
}
