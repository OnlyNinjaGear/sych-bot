import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
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

function ChatProfileCard({ chatId, profile }: { chatId: string; profile: ChatProfile }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [topic, setTopic] = useState(profile.topic || '')
  const [facts, setFacts] = useState(profile.facts || '')
  const [style, setStyle] = useState(profile.style || '')

  const save = useMutation({
    mutationFn: () => api.put(`/profiles/chats/${chatId}`, { topic, facts, style }),
    onSuccess: () => {
      toast.success('Профиль чата обновлён')
      qc.invalidateQueries({ queryKey: ['chat-profiles'] })
      setEditing(false)
    },
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="font-mono text-sm">{chatId}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-normal">{timeAgo(profile.lastUpdated)}</span>
            <Button variant="ghost" size="sm" className="text-xs"
              onClick={() => setEditing(!editing)}>
              {editing ? 'Отмена' : 'Редактировать'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {editing ? (
          <>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Тема (до 200 символов)</p>
              <Input value={topic} onChange={e => setTopic(e.target.value)} maxLength={200}
                placeholder="О чём этот чат..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Стиль</p>
              <Input value={style} onChange={e => setStyle(e.target.value)} maxLength={100}
                placeholder="Стиль общения в чате..." />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Факты (до 500 символов)</p>
              <Textarea value={facts} onChange={e => setFacts(e.target.value)} maxLength={500}
                placeholder="Факты о чате..." rows={3} />
            </div>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
      </CardContent>
    </Card>
  )
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
          <ChatProfileCard key={chatId} chatId={chatId} profile={profile} />
        ))}
      </div>
    </div>
  )
}
