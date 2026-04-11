import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/api'

interface UserProfile {
  realName?: string
  facts?: string
  attitude?: string
  relationship?: number
  location?: string
}

interface ProfilesData {
  profiles: Record<string, Record<string, UserProfile>>
  chatNames: Record<string, string>
}

function ReputationSlider({ chatId, userId, value, onSave }: {
  chatId: string; userId: string; value: number
  onSave: (args: { chatId: string; userId: string; value: number }) => void
}) {
  const [local, setLocal] = useState(value)
  return (
    <div className="flex items-center gap-2">
      <Slider min={0} max={100} step={5} value={[local]} className="flex-1"
        onValueChange={([v]) => setLocal(v)}
        onValueCommit={([v]) => onSave({ chatId, userId, value: v })} />
      <span className="text-xs text-muted-foreground w-8 text-right">{local}</span>
    </div>
  )
}

export default function ProfilesPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [openChat, setOpenChat] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ProfilesData>({
    queryKey: ['profiles'],
    queryFn: () => api.get('/profiles'),
  })

  const deleteUser = useMutation({
    mutationFn: ({ chatId, userId }: { chatId: string; userId: string }) => api.delete(`/profiles/${chatId}/${userId}`),
    onSuccess: () => { toast.success('Профиль удалён'); qc.invalidateQueries({ queryKey: ['profiles'] }) },
  })

  const deleteChat = useMutation({
    mutationFn: (chatId: string) => api.delete(`/profiles/${chatId}`),
    onSuccess: () => { toast.success('Все профили чата удалены'); qc.invalidateQueries({ queryKey: ['profiles'] }) },
  })

  const setReputation = useMutation({
    mutationFn: ({ chatId, userId, value }: { chatId: string; userId: string; value: number }) =>
      api.put(`/profiles/${chatId}/${userId}/reputation`, { value }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['profiles'] }) },
  })

  if (isLoading) return <Skeleton className="h-64 w-full" />

  const profiles = data?.profiles ?? {}
  const chatNames = data?.chatNames ?? {}

  const chatIds = Object.keys(profiles).filter(chatId => {
    const users = profiles[chatId]
    if (!search) return true
    return Object.entries(users).some(([uid, p]) =>
      uid.includes(search) || p.realName?.toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Профили пользователей</h2>
        <Input
          placeholder="Поиск по имени или ID..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {chatIds.length === 0 && (
        <p className="text-muted-foreground text-sm">Нет данных</p>
      )}

      {chatIds.map(chatId => {
        const users = profiles[chatId]
        const filteredUsers = Object.entries(users).filter(([uid, p]) =>
          !search || uid.includes(search) || p.realName?.toLowerCase().includes(search.toLowerCase())
        )
        const isOpen = openChat === chatId

        return (
          <Card key={chatId}>
            <CardHeader
              className="pb-3 cursor-pointer select-none"
              onClick={() => setOpenChat(isOpen ? null : chatId)}
            >
              <CardTitle className="text-base flex items-center justify-between">
                <span>{chatNames[chatId] || `Чат ${chatId}`}</span>
                <span className="flex items-center gap-2">
                  <Badge variant="secondary">{filteredUsers.length} польз.</Badge>
                  <Button variant="ghost" size="sm" className="text-destructive text-xs" onClick={e => {
                    e.stopPropagation()
                    if (confirm('Удалить все профили этого чата?')) deleteChat.mutate(chatId)
                  }}>Очистить чат</Button>
                  <span className="text-muted-foreground text-sm">{isOpen ? '▲' : '▼'}</span>
                </span>
              </CardTitle>
            </CardHeader>

            {isOpen && (
              <CardContent className="flex flex-col gap-3">
                {filteredUsers.map(([uid, profile]) => (
                  <Card key={uid}>
                    <CardContent className="pt-4 flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{profile.realName || 'Без имени'}</p>
                          <p className="text-xs text-muted-foreground">ID: {uid}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {profile.location && (
                            <Badge variant="outline" className="text-xs">{profile.location}</Badge>
                          )}
                          <Button variant="ghost" size="sm" className="text-destructive text-xs shrink-0"
                            onClick={() => deleteUser.mutate({ chatId, userId: uid })}>✕</Button>
                        </div>
                      </div>
                      <ReputationSlider
                        chatId={chatId} userId={uid}
                        value={profile.relationship ?? 50}
                        onSave={args => setReputation.mutate(args)}
                      />
                      {profile.facts && (
                        <p className="text-xs text-muted-foreground">{profile.facts}</p>
                      )}
                      {profile.attitude && (
                        <p className="text-xs italic text-muted-foreground">«{profile.attitude}»</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
