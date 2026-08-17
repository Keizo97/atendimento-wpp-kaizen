// No Next.js 16 este arquivo substitui o antigo middleware.ts.
// Faz duas coisas: renova o cookie de sessao do Supabase e barra quem
// nao esta logado. A checagem de PAPEL fica no layout de cada area.
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rotas que funcionam sem login
const ROTAS_PUBLICAS = ['/login', '/auth']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: nao colocar nada entre createServerClient e getUser,
  // senao a sessao pode ser perdida de forma aleatoria.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const ehPublica = ROTAS_PUBLICAS.some((r) => path.startsWith(r))

  if (!user && !ehPublica) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  // Nao roda em arquivos estaticos nem nas rotas de API
  // (o webhook do Z-API precisa entrar sem login).
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
