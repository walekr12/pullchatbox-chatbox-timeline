import { ActionIcon, Badge, Flex, Text, UnstyledButton } from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import type { Message, Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { IconGitBranch, IconMinus, IconPlus, IconRefresh, IconX } from '@tabler/icons-react'
import { type MouseEvent as ReactMouseEvent, type WheelEvent as ReactWheelEvent, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as scrollActions from '@/stores/scrollActions'
import { switchForkToPosition } from '@/stores/sessionActions'
import { getAllMessageList } from '@/stores/sessionHelpers'
import { useLanguage } from '@/stores/settingsStore'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import { ScalableIcon } from '../common/ScalableIcon'

type TimelineNode = {
  id: string
  label: string
  meta: string
  preview: string
  role: Message['role']
  timestamp?: number
  messageId: string
  forkMessageId?: string
  branchPosition?: number
  branchCount?: number
  branchLabel?: string
  activeBranch?: boolean
  children: TimelineNode[]
  branchChoices?: BranchChoice[]
}

type BranchChoice = {
  position: number
  messageId?: string
  timestamp: number
}

type BranchContext = {
  forkMessageId: string
  branchPosition: number
  branchCount: number
  activeBranch: boolean
}

type PositionedNode = TimelineNode & {
  x: number
  y: number
}

type GraphEdge = {
  from: PositionedNode
  to: PositionedNode
  siblingCount: number
}

type RollTimelineDrawerProps = {
  session: Session
  open: boolean
  onClose: () => void
}

type Viewport = {
  x: number
  y: number
  scale: number
}

const NODE_GAP_X = 170
const NODE_GAP_Y = 118
const CANVAS_PADDING = 76
const MARKER_SIZE = 34

export default function RollTimelineDrawer({ session, open, onClose }: RollTimelineDrawerProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const nodes = useMemo(() => buildTimelineNodes(session), [session])
  const graph = useMemo(() => layoutTimeline(nodes), [nodes])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ x: 32, y: 32, scale: 1 })
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)

  const selectedNode = useMemo(() => {
    if (!selectedId) {
      return graph.nodes[0] ?? null
    }
    return graph.nodes.find((node) => node.id === selectedId) ?? graph.nodes[0] ?? null
  }, [graph.nodes, selectedId])

  const activateNode = useCallback(
    async (node: TimelineNode) => {
      if (node.forkMessageId && typeof node.branchPosition === 'number') {
        await switchForkToPosition(session.id, node.forkMessageId, node.branchPosition)
      } else if (node.branchChoices?.length) {
        const latest = node.branchChoices.reduce((best, item) => (item.timestamp >= best.timestamp ? item : best))
        await switchForkToPosition(session.id, node.messageId, latest.position)
      }

      window.setTimeout(() => {
        void scrollActions.scrollToMessage(session.id, node.messageId, 'center', 'smooth')
      }, 120)
      onClose()
    },
    [onClose, session.id]
  )

  const zoomBy = useCallback((factor: number) => {
    setViewport((current) => ({ ...current, scale: clamp(current.scale * factor, 0.35, 2.5) }))
  }, [])

  const resetViewport = useCallback(() => {
    setViewport({ x: 32, y: 32, scale: 1 })
  }, [])

  const onWheel = useCallback((event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const svgRect = event.currentTarget.getBoundingClientRect()
    const factor = event.deltaY < 0 ? 1.1 : 0.9
    setViewport((current) => {
      const nextScale = clamp(current.scale * factor, 0.35, 2.5)
      const mouseX = event.clientX - svgRect.left
      const mouseY = event.clientY - svgRect.top
      const graphX = (mouseX - current.x) / current.scale
      const graphY = (mouseY - current.y) / current.scale
      return {
        x: mouseX - graphX * nextScale,
        y: mouseY - graphY * nextScale,
        scale: nextScale,
      }
    })
  }, [])

  const onMouseDown = useCallback(
    (event: ReactMouseEvent<SVGSVGElement>) => {
      if (event.button !== 0) {
        return
      }
      dragRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        baseX: viewport.x,
        baseY: viewport.y,
      }
    },
    [viewport.x, viewport.y]
  )

  const onMouseMove = useCallback((event: ReactMouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) {
      return
    }
    setViewport((current) => ({
      ...current,
      x: drag.baseX + event.clientX - drag.startX,
      y: drag.baseY + event.clientY - drag.startY,
    }))
  }, [])

  const stopDrag = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <SwipeableDrawer
      anchor={language === 'ar' ? 'left' : 'right'}
      variant="temporary"
      open={open}
      onClose={onClose}
      onOpen={() => undefined}
      title={t('Roll Timeline') || ''}
      ModalProps={{ keepMounted: true }}
      classes={{
        paper:
          'bg-none box-border max-w-[96vw] w-[760px] flex flex-col gap-0 pt-[var(--mobile-safe-area-inset-top)] pb-[var(--mobile-safe-area-inset-bottom)]',
      }}
      SlideProps={language === 'ar' ? { direction: 'right' } : undefined}
      PaperProps={
        language === 'ar' ? { sx: { direction: 'rtl', overflowY: 'initial' } } : { sx: { overflowY: 'initial' } }
      }
      disableSwipeToOpen={CHATBOX_BUILD_PLATFORM !== 'ios'}
      disableEnforceFocus={true}
    >
      <Flex align="center" justify="space-between" className="px-sm py-xs border-0 border-b border-solid border-chatbox-border-primary">
        <Flex align="center" gap="xs">
          <ScalableIcon icon={IconGitBranch} size={18} />
          <Text size="md" fw={600}>
            {t('Roll Timeline')}
          </Text>
        </Flex>
        <ActionIcon variant="transparent" color="chatbox-primary" onClick={onClose}>
          <ScalableIcon icon={IconX} size={20} />
        </ActionIcon>
      </Flex>

      <div className="relative flex-1 min-h-[520px] overflow-hidden bg-chatbox-background-primary">
        {selectedNode && <PreviewCard node={selectedNode} />}
        <Flex gap={6} className="absolute left-sm top-sm z-10">
          <ActionIcon size="sm" variant="filled" color="chatbox-primary" onClick={() => zoomBy(1.16)}>
            <ScalableIcon icon={IconPlus} size={15} />
          </ActionIcon>
          <ActionIcon size="sm" variant="filled" color="chatbox-primary" onClick={() => zoomBy(0.86)}>
            <ScalableIcon icon={IconMinus} size={15} />
          </ActionIcon>
          <ActionIcon size="sm" variant="filled" color="chatbox-primary" onClick={resetViewport}>
            <ScalableIcon icon={IconRefresh} size={15} />
          </ActionIcon>
        </Flex>
        {graph.nodes.length > 0 ? (
          <svg
            className="h-full w-full cursor-grab active:cursor-grabbing"
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={stopDrag}
            onMouseLeave={stopDrag}
          >
            <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
              <rect x={-2000} y={-2000} width={graph.width + 4000} height={graph.height + 4000} fill="transparent" />
              {graph.edges.map((edge) => (
                <PedigreeEdge key={edge.from.id + '->' + edge.to.id} edge={edge} />
              ))}
              {graph.nodes.map((node) => (
                <GraphNode
                  key={node.id}
                  node={node}
                  selected={selectedNode?.id === node.id}
                  onSelect={setSelectedId}
                  onActivate={activateNode}
                />
              ))}
            </g>
          </svg>
        ) : (
          <Text size="sm" c="chatbox-tertiary" className="px-sm py-md">
            {t('No roll timeline yet')}
          </Text>
        )}
      </div>
    </SwipeableDrawer>
  )
}

function PreviewCard({ node }: { node: TimelineNode }) {
  return (
    <div
      className="absolute z-20 rounded-md border border-solid border-chatbox-border-primary bg-chatbox-background-secondary p-sm shadow-lg"
      style={{ top: 12, right: 12, width: 280, maxWidth: 'calc(100% - 24px)' }}
    >
      <Flex align="center" gap="xs" wrap="wrap" mb={4}>
        <Badge size="xs" color={node.role === 'user' ? 'blue' : 'chatbox-brand'}>
          {node.role}
        </Badge>
        {node.branchLabel && (
          <Badge size="xs" variant="light">
            {node.branchLabel}
          </Badge>
        )}
        {node.branchCount && (
          <Badge size="xs" variant="light">
            {node.branchCount} paths
          </Badge>
        )}
        {node.activeBranch && (
          <Badge size="xs" color="chatbox-brand" variant="light">
            Current
          </Badge>
        )}
      </Flex>
      <Text size="xs" c="chatbox-tertiary" lineClamp={1}>
        {node.meta}
      </Text>
      <Text size="sm" fw={600} lineClamp={1} mt={3}>
        {node.label}
      </Text>
      <Text size="xs" c="chatbox-secondary" mt={5} className="whitespace-pre-wrap break-words" lineClamp={7}>
        {node.preview}
      </Text>
    </div>
  )
}

function GraphNode(props: {
  node: PositionedNode
  selected: boolean
  onSelect: (id: string) => void
  onActivate: (node: TimelineNode) => void
}) {
  const { node, selected, onSelect, onActivate } = props
  const markerFill = node.role === 'assistant' ? '#2f80ed' : '#ffffff'
  const markerStroke = selected ? '#0b7cff' : '#111827'
  const text = trimPreview(node.preview, 54)

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => void onActivate(node)}
      style={{ cursor: 'pointer' }}
    >
      {node.role === 'assistant' ? (
        <circle r={MARKER_SIZE / 2} fill={markerFill} stroke={markerStroke} strokeWidth={selected ? 4 : 3} />
      ) : node.role === 'user' ? (
        <rect
          x={-MARKER_SIZE / 2}
          y={-MARKER_SIZE / 2}
          width={MARKER_SIZE}
          height={MARKER_SIZE}
          rx={3}
          fill={markerFill}
          stroke={markerStroke}
          strokeWidth={selected ? 4 : 3}
        />
      ) : (
        <rect
          x={-MARKER_SIZE / 2}
          y={-MARKER_SIZE / 2}
          width={MARKER_SIZE}
          height={MARKER_SIZE}
          transform="rotate(45)"
          fill="#f3f4f6"
          stroke={markerStroke}
          strokeWidth={selected ? 4 : 3}
        />
      )}
      {node.branchCount && (
        <g transform="translate(18 -28)">
          <circle r={11} fill="#dbeafe" stroke="#93c5fd" />
          <text textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="700" fill="#1d4ed8">
            {node.branchCount}
          </text>
        </g>
      )}
      <text x={0} y={MARKER_SIZE / 2 + 18} textAnchor="middle" fontSize="12" fontWeight="700" fill="#111827">
        {node.role}
      </text>
      <text x={0} y={MARKER_SIZE / 2 + 34} textAnchor="middle" fontSize="11" fill="#6b7280">
        {text}
      </text>
    </g>
  )
}

function PedigreeEdge({ edge }: { edge: GraphEdge }) {
  const startY = edge.from.y + MARKER_SIZE / 2
  const endY = edge.to.y - MARKER_SIZE / 2
  if (edge.siblingCount <= 1) {
    return <path d={`M ${edge.from.x} ${startY} V ${endY}`} fill="none" stroke="#111827" strokeWidth={3} />
  }

  const forkY = startY + Math.max(28, (endY - startY) * 0.45)
  return (
    <path
      d={`M ${edge.from.x} ${startY} V ${forkY} H ${edge.to.x} V ${endY}`}
      fill="none"
      stroke="#111827"
      strokeWidth={3}
      strokeLinejoin="round"
    />
  )
}

function buildTimelineNodes(session: Session): TimelineNode[] {
  const messages = getAllMessageList(session)
  if (messages.length === 0) {
    return []
  }
  return buildMessagePath(session, messages, 0, undefined, new Set<string>())
}

function buildMessagePath(
  session: Session,
  messages: Message[],
  index: number,
  branchContext: BranchContext | undefined,
  visitedForks: Set<string>
): TimelineNode[] {
  if (index >= messages.length) {
    return []
  }

  const message = messages[index]
  const fork = session.messageForksHash?.[message.id]
  const node = createMessageNode(message, branchContext)

  if (fork && fork.lists.length > 1 && !visitedForks.has(message.id)) {
    const nextVisited = new Set(visitedForks)
    nextVisited.add(message.id)
    const currentTail = messages.slice(index + 1)
    const branchPaths = fork.lists.flatMap((list, branchIndex) => {
      const branchMessages = branchIndex === fork.position ? currentTail : list.messages
      const branchPath = buildMessagePath(
        session,
        branchMessages,
        0,
        {
          forkMessageId: message.id,
          branchPosition: branchIndex,
          branchCount: fork.lists.length,
          activeBranch: branchIndex === fork.position,
        },
        nextVisited
      )
      if (branchPath[0]) {
        branchPath[0].branchLabel = `Branch ${branchIndex + 1}`
      }
      return branchPath
    })

    node.branchCount = fork.lists.length
    node.branchChoices = fork.lists.map((list, branchIndex) => {
      const branchMessages = branchIndex === fork.position ? currentTail : list.messages
      return {
        position: branchIndex,
        messageId: branchMessages[0]?.id,
        timestamp: latestMessageTimestamp(branchMessages) ?? fork.createdAt,
      }
    })
    node.children = branchPaths
    return [node]
  }

  node.children = buildMessagePath(session, messages, index + 1, branchContext, visitedForks)
  return [node]
}

function createMessageNode(message: Message, branchContext?: BranchContext): TimelineNode {
  return {
    id: ['message', message.id, branchContext?.forkMessageId ?? 'root', branchContext?.branchPosition ?? 'current'].join(':'),
    label: labelForMessage(message),
    meta: metaForMessage(message, branchContext),
    preview: previewForMessage(message),
    role: message.role,
    timestamp: message.timestamp,
    messageId: message.id,
    forkMessageId: branchContext?.forkMessageId,
    branchPosition: branchContext?.branchPosition,
    branchCount: branchContext?.branchCount,
    activeBranch: branchContext?.activeBranch,
    children: [],
  }
}

function layoutTimeline(roots: TimelineNode[]) {
  const positioned: PositionedNode[] = []
  const edges: GraphEdge[] = []
  let cursorX = CANVAS_PADDING

  const place = (node: TimelineNode, level: number): PositionedNode => {
    const placedChildren = node.children.map((child) => place(child, level + 1))
    const x =
      placedChildren.length > 0
        ? (placedChildren[0].x + placedChildren[placedChildren.length - 1].x) / 2
        : cursorX
    if (placedChildren.length === 0) {
      cursorX += NODE_GAP_X
    }
    const placed: PositionedNode = {
      ...node,
      x,
      y: CANVAS_PADDING + level * NODE_GAP_Y,
    }
    positioned.push(placed)
    for (const child of placedChildren) {
      edges.push({ from: placed, to: child, siblingCount: placedChildren.length })
    }
    return placed
  }

  roots.forEach((root) => place(root, 0))
  const maxX = positioned.reduce((max, node) => Math.max(max, node.x), CANVAS_PADDING)
  const maxY = positioned.reduce((max, node) => Math.max(max, node.y), CANVAS_PADDING)
  return {
    nodes: positioned,
    edges,
    width: maxX + CANVAS_PADDING,
    height: maxY + CANVAS_PADDING,
  }
}

function labelForMessage(message: Message) {
  const role = message.role || 'message'
  const text = previewForMessage(message)
  return text ? `${role}: ${trimPreview(text, 80)}` : role
}

function metaForMessage(message: Message, branchContext?: BranchContext) {
  const branchMeta = branchContext ? `Branch ${branchContext.branchPosition + 1} / ${branchContext.branchCount}` : undefined
  return [branchMeta, formatDate(message.timestamp), message.model, message.aiProvider].filter(Boolean).join(' - ')
}

function previewForMessage(message: Message) {
  return trimPreview(getMessageText(message, true, false), 300)
}

function trimPreview(text: string, maxLength: number) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized
}

function latestMessageTimestamp(messages: Message[]) {
  return messages.reduce<number | undefined>((latest, message) => {
    if (!message.timestamp) {
      return latest
    }
    return latest === undefined ? message.timestamp : Math.max(latest, message.timestamp)
  }, undefined)
}

function formatDate(timestamp?: number) {
  return timestamp ? new Date(timestamp).toLocaleString() : ''
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}
