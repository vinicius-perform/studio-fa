// src/middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;

  // Ignorar arquivos estáticos e internos
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return response;
  }

  // Verifica se DevStore está explicitamente habilitado em desenvolvimento
  const isDevStoreEnabled =
    process.env.NODE_ENV !== 'production' && process.env.STUDIO_FA_ENABLE_DEV_STORE === 'true';

  if (isDevStoreEnabled) {
    // Em modo DevStore explícito, permite navegação sem bloqueio rígido do Supabase Auth
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (pathname === '/login') return response;
    return NextResponse.redirect(new URL('/login?error=unconfigured', request.url));
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: '', ...options });
        response = NextResponse.next({
          request: {
            headers: request.headers,
          },
        });
        response.cookies.set({ name, value: '', ...options });
      },
    },
  });

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    // Falha de conexão com o Supabase
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { message: 'Não foi possível conectar ao Studio FA. Tente novamente.' } },
        { status: 503 }
      );
    }
    if (pathname !== '/login') {
      return NextResponse.redirect(new URL('/login?error=connection', request.url));
    }
    return response;
  }

  // 1. Bloqueia acesso a rotas privadas para usuários não autenticados
  if (!user) {
    if (pathname === '/login') {
      return response;
    }

    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { message: 'Sessão inválida ou expirada. Faça login para continuar.' } },
        { status: 401 }
      );
    }

    const redirectUrl = new URL('/login', request.url);
    if (pathname !== '/') {
      redirectUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(redirectUrl);
  }

  // 2. Para usuário autenticado, busca a role para fazer roteamento correto
  let role: string | null = null;
  try {
    const { data: member } = await supabase
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    role = member?.role || null;
  } catch {
    role = null;
  }

  // Se está autenticado e tenta acessar /login, redireciona para a home de acordo com a role
  if (pathname === '/login') {
    if (role === 'designer') {
      return NextResponse.redirect(new URL('/create', request.url));
    }
    if (role === 'viewer') {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Se não for rota de API, aplica as regras de guarda por Role nas telas
  if (!pathname.startsWith('/api/')) {
    // Rota / (Painel Operacional) é somente para Admin e Owner
    if (pathname === '/') {
      if (role === 'designer') {
        return NextResponse.redirect(new URL('/create', request.url));
      }
      if (role === 'viewer') {
        return NextResponse.redirect(new URL('/projects', request.url));
      }
    }

    // Rotas administrativas: /users e /settings
    const isAdminRoute = pathname.startsWith('/users') || pathname.startsWith('/settings');
    if (isAdminRoute && role !== 'owner' && role !== 'admin') {
      const destination = role === 'designer' ? '/create' : '/projects';
      return NextResponse.redirect(new URL(destination, request.url));
    }

    // Rota de criação (/create): Viewer não pode acessar
    if (pathname.startsWith('/create') && role === 'viewer') {
      return NextResponse.redirect(new URL('/projects', request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
