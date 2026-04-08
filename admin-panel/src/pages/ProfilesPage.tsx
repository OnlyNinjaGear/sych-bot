import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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

export default function ProfilesPage() {
  const [search, setSearch] = useState('')
  const [openChat, setOpenChat] = useState<string | null>(null)

  const { data, isLoading } = useQuery<ProfilesData>({
    queryKey: ['profiles'],
    queryFn: () => api.get('/profiles'),
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
                        {profile.location && (
                          <Badge variant="outline" className="text-xs">{profile.location}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={profile.relationship ?? 50} className="flex-1 h-2" />
                        <span className="text-xs text-muted-foreground w-8 text-right">{profile.relationship ?? 50}</span>
                      </div>
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
