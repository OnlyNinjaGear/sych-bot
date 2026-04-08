import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'

interface LogsData {
  lines: string[]
}

function classifyLine(line: string) {
  const l = line.toLowerCase()
  if (l.includes('error') || l.includes('err:') || l.includes('ошибка')) return 'error'
  if (l.includes('warn') || l.includes('предупреждение')) return 'warn'
  if (l.includes('✓') || l.includes('success') || l.includes('готов')) return 'success'
  return 'default'
}

const lineColors: Record<string, string> = {
  error: 'text-destructive',
  warn: 'text-yellow-400',
  success: 'text-green-400',
  default: 'text-muted-foreground',
}

export default function LogsPage() {
  const [type, setType] = useState<'out' | 'err'>('out')
  const [lines, setLines] = useState('200')
  const [autoScroll, setAutoScroll] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data, isLoading, refetch, isFetching } = useQuery<LogsData>({
    queryKey: ['logs', type, lines],
    queryFn: () => api.get(`/logs?type=${type}&lines=${lines}`),
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [data, autoScroll])

  const logLines = data?.lines ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">Логи</h2>
        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={v => setType(v as 'out' | 'err')}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="out">stdout</SelectItem>
              <SelectItem value="err">stderr</SelectItem>
            </SelectContent>
          </Select>
          <Select value={lines} onValueChange={setLines}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 строк</SelectItem>
              <SelectItem value="200">200 строк</SelectItem>
              <SelectItem value="500">500 строк</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? '...' : '↺'}
          </Button>
          <Button
            variant={autoScroll ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoScroll(s => !s)}
          >
            {autoScroll ? '⬇ Auto' : '⬇ Off'}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span>PM2 лог</span>
            <Badge variant="secondary">{logLines.length} строк</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <Skeleton className="h-96 w-full rounded-none rounded-b-lg" />
          ) : (
            <div className="h-[600px] overflow-y-auto bg-black/90 rounded-b-lg p-4 font-mono text-xs">
              {logLines.length === 0 && (
                <p className="text-muted-foreground">Нет логов</p>
              )}
              {logLines.map((line, i) => (
                <div key={i} className={`leading-5 whitespace-pre-wrap break-all ${lineColors[classifyLine(line)]}`}>
                  {line}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
