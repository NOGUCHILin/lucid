import { redirect } from 'next/navigation'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  // 招待コード付きでログインページへリダイレクト
  redirect(`/login?code=${encodeURIComponent(code)}`)
}
