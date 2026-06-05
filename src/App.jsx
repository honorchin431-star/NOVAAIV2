import { useEffect, useRef, useState } from 'react'
import {
  Plus,
  MessageSquare,
  Send,
  Sparkles,
  User,
  Menu,
  PanelLeftClose,
  ImagePlus,
  X,
  Copy,
  Check,
} from 'lucide-react'

const HF_MODEL = 'meta-llama/Meta-Llama-3-8B-Instruct'
const HF_API_URL = import.meta.env.DEV
  ? '/api/hf/v1/chat/completions'
  : 'https://router.huggingface.co/v1/chat/completions'

const SCROLL_BOTTOM_THRESHOLD = 80
const MAX_IMAGE_SIZE_MB = 5
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

function buildApiMessageContent(message) {
  if (!message.imageUrl) {
    return message.content
  }

  const parts = []
  const text = message.content?.trim()
  if (text) {
    parts.push({ type: 'text', text })
  }
  parts.push({
    type: 'image_url',
    image_url: { url: message.imageUrl },
  })
  return parts
}

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'user',
    content: 'Can you explain what glassmorphism is?',
  },
  {
    id: 2,
    role: 'assistant',
    content:
      'Glassmorphism is a UI design style that combines semi-transparent backgrounds with backdrop blur (`backdrop-filter: blur`). It makes interface elements look like frosted glass floating above the background — modern, layered, and commonly used in sidebars, cards, and modals.',
  },
  {
    id: 3,
    role: 'user',
    content: 'That sounds great! Can you give me a simple way to implement it?',
  },
  {
    id: 4,
    role: 'assistant',
    content:
      'Sure. The core CSS usually has three parts:\n\n1. A semi-transparent background, e.g. `rgba(255, 255, 255, 0.1)`\n2. `backdrop-filter: blur(20px)` for the frosted blur\n3. A subtle white border and soft shadow to enhance the glass feel\n\nPair it with an animated gradient background for an even better result.',
  },
]

const INITIAL_CHAT_ID = 1

function makeChatTitle(text) {
  const trimmed = text.trim()
  if (trimmed.length <= 20) return trimmed
  return `${trimmed.slice(0, 20)}...`
}

function AuroraBackground() {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <div className="aurora-blob aurora-blob-1" />
      <div className="aurora-blob aurora-blob-2" />
      <div className="aurora-blob aurora-blob-3" />
      <div className="aurora-blob aurora-blob-4" />
      <div className="aurora-blob aurora-blob-5" />
    </div>
  )
}

function Sidebar({
  chatHistory,
  activeId,
  onSelect,
  onNewChat,
  collapsed,
  onToggle,
}) {
  return (
    <aside
      className={`sidebar-panel glass fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col transition-all duration-300 md:relative md:z-10 md:max-w-none md:shrink-0 ${
        collapsed
          ? 'sidebar-panel--collapsed -translate-x-full pointer-events-none md:translate-x-0 md:w-0 md:max-w-0 md:overflow-hidden md:border-0 md:opacity-0 md:shadow-none'
          : 'translate-x-0 opacity-100'
      }`}
      aria-hidden={collapsed}
    >
      <div className="flex items-center gap-2 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
          <Sparkles className="h-5 w-5 text-violet-300" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-white">
          Nova
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="ml-auto rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all hover:bg-white/15 hover:shadow-lg"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto chat-scroll px-3 py-2">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-white/40">
          History
        </p>
        {chatHistory.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-white/30">
            No chat history yet
          </p>
        ) : (
          <ul className="space-y-1">
            {chatHistory.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                    activeId === item.id
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-white/40 group-hover:text-white/60" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-white/35">{item.date}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 text-xs font-bold text-white">
            U
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-white">User</p>
            <p className="text-xs text-white/40">Free Plan</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)

  // 处理文本复制功能
  const handleCopy = async () => {
    if (!message.content) return
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      // 2秒后自动恢复原状
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <div
      className={`message-animate flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500'
            : 'bg-white/10'
        }`}
      >
        {isUser ? (
          <User className="h-4 w-4 text-white" />
        ) : (
          <Sparkles className="h-4 w-4 text-violet-300" />
        )}
      </div>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'glass-strong text-white'
            : message.error
              ? 'border border-red-400/30 bg-red-500/10 text-red-200'
              : 'bg-white/5 text-white/90'
        }`}
      >
        {message.loading ? (
          <div className="flex items-center gap-2 text-white/70">
            <span>Nova is thinking</span>
            <span className="flex items-center gap-1 pt-1">
              <span className="thinking-dot" />
              <span className="thinking-dot" />
              <span className="thinking-dot" />
            </span>
          </div>
        ) : (
          <>
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="Uploaded"
                className="mb-2 max-h-48 max-w-full rounded-xl object-contain"
              />
            )}
            {message.content
              ? message.content.split('\n').map((line, i) => (
                  <p key={i} className={i > 0 ? 'mt-2' : ''}>
                    {line}
                  </p>
                ))
              : null}

            {/* 只在 AI 成功回复且有内容时显示复制按钮 */}
            {!isUser && message.content && !message.error && (
              <div className="mt-2.5 flex justify-end">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-xs text-white/40 transition-all hover:bg-white/10 hover:text-white"
                  title="Copy response"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-green-400" />
                      <span className="text-green-400 font-medium">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ChatArea({
  messages,
  activeChatId,
  newChatTrigger,
  onEnsureChat,
  onUpdateMessages,
  sidebarCollapsed,
  onToggleSidebar,
}) {
  const [input, setInput] = useState('')
  const [selectedImage, setSelectedImage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const nextId = useRef(1)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const isAtBottomRef = useRef(true)

  useEffect(() => {
    const maxId = messages.reduce((max, m) => Math.max(max, m.id), 0)
    nextId.current = maxId + 1
  }, [activeChatId, messages])

  const checkIsAtBottom = () => {
    const el = containerRef.current
    if (!el) return true
    return (
      el.scrollHeight - el.scrollTop - el.clientHeight <=
      SCROLL_BOTTOM_THRESHOLD
    )
  }

  const scrollToBottom = () => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }

  const handleContainerScroll = () => {
    isAtBottomRef.current = checkIsAtBottom()
  }

  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]
    const isUserMessage = lastMessage?.role === 'user'

    if (isUserMessage) {
      isAtBottomRef.current = true
    }

    if (isUserMessage || isAtBottomRef.current) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [messages])

  useEffect(() => {
    setInput('')
    setSelectedImage(null)
    setIsLoading(false)
    isAtBottomRef.current = true
    const timer = setTimeout(() => inputRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [newChatTrigger, activeChatId])

  const clearSelectedImage = () => {
    setSelectedImage(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      alert('Please select a JPEG, PNG, WebP, or GIF image.')
      e.target.value = ''
      return
    }

    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      alert(`Image must be smaller than ${MAX_IMAGE_SIZE_MB} MB.`)
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage({
        file,
        dataUrl: reader.result,
        name: file.name,
      })
    }
    reader.onerror = () => {
      alert('Failed to read the image. Please try again.')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const fetchAiReply = async (chatId, history, loadingId) => {
    const token = import.meta.env.VITE_HF_TOKEN?.trim()
    if (!token) {
      console.error('[Nova API] VITE_HF_TOKEN is missing or empty')
      onUpdateMessages(chatId, (prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                loading: false,
                error: true,
                content: '⚠️ API token not found. Please check VITE_HF_TOKEN in your .env file.',
              }
            : m,
        ),
      )
      setIsLoading(false)
      return
    }

    const requestBody = {
      model: HF_MODEL,
      messages: history.map((m) => ({
        role: m.role,
        content: buildApiMessageContent(m),
      })),
      max_tokens: 1024,
    }

    const authHeader = `Bearer ${token}`

    console.log('[Nova API] Sending request', {
      url: HF_API_URL,
      model: HF_MODEL,
      messageCount: requestBody.messages.length,
      tokenPresent: true,
      tokenPrefix: `${token.slice(0, 7)}...`,
      authFormatValid: authHeader.startsWith('Bearer hf_'),
      viaProxy: import.meta.env.DEV,
    })

    try {
      const response = await fetch(HF_API_URL, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json().catch(() => ({}))

      console.log('[Nova API] Response status', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data,
      })

      if (!response.ok) {
        const errMsg =
          data.error?.message ||
          data.error ||
          data.message ||
          (typeof data === 'string' ? data : null) ||
          `Request failed (HTTP ${response.status})`
        throw new Error(errMsg)
      }

      const reply = data.choices?.[0]?.message?.content
      if (!reply) {
        throw new Error('API returned an empty response. Please try again later.')
      }

      onUpdateMessages(chatId, (prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? { ...m, content: reply, loading: false, error: false }
            : m,
        ),
      )
    } catch (error) {
      console.error('[Nova API] Request failed:', error)
      console.error('[Nova API] Error details:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
        likelyCors:
          error?.message === 'Failed to fetch' ||
          error?.name === 'TypeError',
      })

      const isLikelyCors = error?.message === 'Failed to fetch'
      const userMessage = isLikelyCors
        ? '⚠️ Network request blocked (usually a browser CORS issue). Open the F12 console and check [Nova API] logs. A Vite proxy is configured for dev — restart the dev server and try again.'
        : `⚠️ ${error?.message || 'Request failed. Please try again later.'}`

      onUpdateMessages(chatId, (prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                loading: false,
                error: true,
                content: userMessage,
              }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const trimmed = input.trim()
    if ((!trimmed && !selectedImage) || isLoading) return

    const chatId = onEnsureChat(trimmed || '[Image]')

    const userMsg = {
      id: nextId.current++,
      role: 'user',
      content: trimmed,
      ...(selectedImage ? { imageUrl: selectedImage.dataUrl } : {}),
    }
    const loadingId = nextId.current++
    const loadingMsg = {
      id: loadingId,
      role: 'assistant',
      content: '',
      loading: true,
    }

    const history = [
      ...messages.filter((m) => !m.loading && !m.error),
      userMsg,
    ]

    onUpdateMessages(chatId, (prev) => [...prev, userMsg, loadingMsg])
    setInput('')
    clearSelectedImage()
    setIsLoading(true)
    fetchAiReply(chatId, history, loadingId)
  }

  const canSend = (input.trim() || selectedImage) && !isLoading

  return (
    <main className="chat-area glass relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden rounded-none md:rounded-2xl">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3 md:px-6 md:py-4">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="sidebar-toggle shrink-0 rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
          aria-expanded={!sidebarCollapsed}
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-violet-300" />
          <h1 className="truncate text-base font-semibold text-white">Nova AI</h1>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">
          Gemini Style
        </span>
      </header>

      <div
        ref={containerRef}
        onScroll={handleContainerScroll}
        className="chat-scroll flex-1 overflow-y-auto px-6 py-6"
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Sparkles className="h-7 w-7 text-violet-300" />
              </div>
              <h2 className="text-lg font-semibold text-white">Start a new chat</h2>
              <p className="mt-2 max-w-sm text-sm text-white/45">
                What would you like to talk about? Type your message below and Nova is ready to help.
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))
          )}
        </div>
      </div>

      <footer className="border-t border-white/10 px-4 py-4 md:px-6">
        <form onSubmit={handleSubmit} className="mx-auto max-w-3xl">
          {selectedImage && (
            <div className="image-preview mb-3">
              <div className="image-preview__thumb">
                <img
                  src={selectedImage.dataUrl}
                  alt={selectedImage.name}
                  className="image-preview__img"
                />
              </div>
              <div className="image-preview__meta min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {selectedImage.name}
                </p>
                <p className="text-xs text-white/40">Ready to send with your message</p>
              </div>
              <button
                type="button"
                onClick={clearSelectedImage}
                className="image-preview__remove shrink-0 rounded-lg p-1.5 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <div className="glass-strong flex flex-1 items-end gap-2 rounded-2xl px-3 py-3 transition-all focus-within:border-white/25 focus-within:shadow-lg md:px-4">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES.join(',')}
                onChange={handleImageSelect}
                className="sr-only"
                aria-hidden="true"
                tabIndex={-1}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/50 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Upload image"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmit(e)
                  }
                }}
                placeholder={
                  isLoading
                    ? 'Nova is replying...'
                    : selectedImage
                      ? 'Add a caption (optional)...'
                      : 'Type your message...'
                }
                rows={1}
                disabled={isLoading}
                className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-sm text-white placeholder-white/35 outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!canSend}
                className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white transition-all hover:shadow-lg hover:shadow-violet-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-white/30">
          Nova can make mistakes. Please verify important information.
        </p>
      </footer>
    </main>
  )
}

function App() {
  const nextChatId = useRef(INITIAL_CHAT_ID + 1)

  const [chatHistory, setChatHistory] = useState([
    {
      id: INITIAL_CHAT_ID,
      title: makeChatTitle(INITIAL_MESSAGES[0].content),
      date: 'Today',
      messages: INITIAL_MESSAGES,
    },
  ])
  const [activeChatId, setActiveChatId] = useState(INITIAL_CHAT_ID)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [newChatTrigger, setNewChatTrigger] = useState(0)

  const activeChat = chatHistory.find((c) => c.id === activeChatId)
  const currentMessages =
    activeChatId === null ? [] : (activeChat?.messages ?? [])

  const handleNewChat = () => {
    setActiveChatId(null)
    setNewChatTrigger((n) => n + 1)
  }

  const handleSelectChat = (id) => {
    setActiveChatId(id)
    if (window.innerWidth < 768) {
      setSidebarCollapsed(true)
    }
  }

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => !prev)
  }

  const ensureActiveChat = (firstMessage) => {
    if (activeChatId !== null) {
      const existing = chatHistory.find((c) => c.id === activeChatId)
      const hasUserMessage = existing?.messages.some((m) => m.role === 'user')
      if (hasUserMessage) return activeChatId

      const title = makeChatTitle(firstMessage)
      setChatHistory((prev) =>
        prev.map((c) =>
          c.id === activeChatId ? { ...c, title } : c,
        ),
      )
      return activeChatId
    }

    const id = nextChatId.current++
    const title = makeChatTitle(firstMessage)
    const newChat = { id, title, date: 'Today', messages: [] }

    setChatHistory((prev) => [newChat, ...prev])
    setActiveChatId(id)
    return id
  }

  const updateMessages = (chatId, updater) => {
    setChatHistory((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c
        const newMessages =
          typeof updater === 'function' ? updater(c.messages) : updater
        return { ...c, messages: newMessages }
      }),
    )
  }

  return (
    <div className="relative flex h-full w-full">
      <AuroraBackground />

      <div className="app-shell relative z-10 flex h-full w-full">
        {!sidebarCollapsed && (
          <button
            type="button"
            className="sidebar-backdrop"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Close sidebar"
          />
        )}
        <Sidebar
          chatHistory={chatHistory}
          activeId={activeChatId}
          onSelect={handleSelectChat}
          onNewChat={() => {
            handleNewChat()
            if (window.innerWidth < 768) {
              setSidebarCollapsed(true)
            }
          }}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(true)}
        />
        <ChatArea
          messages={currentMessages}
          activeChatId={activeChatId}
          newChatTrigger={newChatTrigger}
          onEnsureChat={ensureActiveChat}
          onUpdateMessages={updateMessages}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
        />
      </div>
    </div>
  )
}

export default App

 