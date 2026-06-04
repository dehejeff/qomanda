import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/checkin/redirect?slug=&mesa=&t=
 * Redirect HTTP 302 — contorna bloqueios de navegação em PWA/mobile.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')?.trim()
  const mesa = req.nextUrl.searchParams.get('mesa')?.trim()
  const token = req.nextUrl.searchParams.get('t')?.trim()

  if (!slug || !mesa || !token) {
    return NextResponse.redirect(new URL('/scan', req.url))
  }

  if (!/^[a-z0-9-]+$/i.test(slug)) {
    return NextResponse.redirect(new URL('/scan', req.url))
  }

  const target = new URL(`/${slug}`, req.url)
  target.searchParams.set('mesa', mesa)
  target.searchParams.set('t', token)

  return NextResponse.redirect(target, { status: 302 })
}
