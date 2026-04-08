import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/lib/api'

interface ChatProfile {
  topic?: string
  facts?: string
  style?: string
  lastUpdated?: number
}

type ChatProfilesData = Record<string, ChatProfile>

function timeAgo(ts?: number) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return `${diff}с назад`
  if (diff < 3600) return `${Math.floor(diff / 60)}м назад`
  if (diff < 86400) return `${Math.floor(diff / 3600)}ч назад`
  return `${Math.floor(diff / 86400)}д назад`
}

export default function ChatProfilesPage() {
  const { data, isLoading } = useQuery<ChatProfilesData>({
    queryKey: ['chat-profiles'],
    queryFn: () => api.get('/profiles/chats'),
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  const entries = Object.entries(data ?? {})

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Профили чатов</h2>

      {entries.length === 0 && (
        <p className="text-muted-foreground text-sm">Нет данных</p>
      )}

      <div className="grid grid-cols-1 gap-4">
        {entries.map(([chatId, profile]) => (
          <Card key={chatId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="font-mono text-sm">{chatId}</span>
                <span className="text-xs text-muted-foreground font-normal">{timeAgo(profile.lastUpdated)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {profile.topic && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Тема</p>
                  <p className="text-sm">{profile.topic}</p>
                </div>
              )}
              {profile.style && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Стиль:</p>
                  <Badge variant="secondary" className="text-xs">{profile.style}</Badge>
                </div>
              )}
              {profile.facts && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Факты</p>
                  <p className="text-xs text-muted-foreground">{profile.facts}</p>
                </div>
              )}
              {!profile.topic && !profile.facts && (
                <p className="text-xs text-muted-foreground">Нет данных о чате</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
