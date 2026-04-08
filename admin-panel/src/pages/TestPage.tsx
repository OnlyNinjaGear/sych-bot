import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import type { ChatStatus } from 'ai'
import { api } from '@/lib/api'
import { PROVIDERS, NATIVE_MODELS, type ProviderId } from '@/lib/models'
import { ModelSelect } from '@/components/model-select'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface BotSettings {
  mainModel: string
  aiProvider?: ProviderId
}

export default function TestPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [status, setStatus] = useState<ChatStatus>('ready')
  const [model, setModel] = useState('')

  const { data: settings } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/settings'),
  })

  useEffect(() => {
    if (settings?.mainModel && !model) setModel(settings.mainModel)
  }, [settings, model])

  const provider = settings?.aiProvider ?? 'openrouter'
  const apiModels = PROVIDERS[provider]?.models ?? PROVIDERS.openrouter.models

  async function handleSubmit({ text }: { text: string }) {
    const trimmed = text.trim()
    if (!trimmed || status !== 'ready') return

    const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(next)
    setStatus('submitted')

    try {
      const data = await api.post('/test', {
        messages: next.map(m => ({ role: m.role, content: m.content })),
        model: model || undefined,
      }) as { content: string }
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
      setStatus('ready')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      toast.error(msg)
      setMessages(prev => prev.slice(0, -1))
      setStatus('error')
      setTimeout(() => setStatus('ready'), 2000)
    }
  }

  return (
    <div className="flex flex-col gap-3 h-[calc(100vh-8rem)] max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-2 shrink-0">
        <h2 className="text-xl font-semibold">Тест бота</h2>
        <div className="flex items-center gap-2">
          <div className="w-72">
            <ModelSelect
              value={model}
              onChange={setModel}
              groups={[
                { freeLabel: 'API — Бесплатные', paidLabel: 'API — Платные', models: apiModels },
                { freeLabel: 'Native — Бесплатные', paidLabel: 'Native — Платные', models: NATIVE_MODELS },
              ]}
              className="w-full font-mono text-xs"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setMessages([]); setStatus('ready') }}
            disabled={messages.length === 0}
          >
            Сбросить
          </Button>
        </div>
      </div>

      <Conversation className="flex-1 rounded-lg border">
        <ConversationContent>
          {messages.length === 0 && (
            <ConversationEmptyState
              title="Тут пусто"
              description="Напиши что-нибудь — Тоха ответит"
            />
          )}
          {messages.map((m, i) => (
            <Message key={i} from={m.role}>
              <MessageContent>
                {m.role === 'assistant'
                  ? <MessageResponse>{m.content}</MessageResponse>
                  : m.content
                }
              </MessageContent>
            </Message>
          ))}
          {status === 'submitted' && (
            <Message from="assistant">
              <MessageContent>
                <span className="text-muted-foreground animate-pulse text-sm">...</span>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <PromptInput onSubmit={handleSubmit} className="shrink-0">
        <PromptInputBody>
          <PromptInputTextarea placeholder="Введите запрос" />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            {model && (
              <span className="text-xs text-muted-foreground font-mono truncate max-w-48">{model}</span>
            )}
          </PromptInputTools>
          <PromptInputSubmit status={status} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
