import { ActionIcon, Badge, Flex, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import type { Message, Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { IconGitBranch, IconMessage, IconX } from '@tabler/icons-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as scrollActions from '@/stores/scrollActions'
import { switchForkToPosition } from '@/stores/sessionActions'
import { getAllMessageList } from '@/stores/sessionHelpers'
import { useLanguage } from '@/stores/settingsStore'
import { CHATBOX_BUILD_PLATFORM } from '@/variables'
import { ScalableIcon } from '../common/ScalableIcon'

type TimelineNode = {
  id: string
  type: 'message' | 'branch'
  label: string
  meta: string
  preview: string
  depth: number
  timestamp?: number
  messageId?: string
  forkMessageId?: string
  branchPosition?: number
  branchCount?: number
  active?: boolean
  children: TimelineNode[]
  branchChoices?: BranchChoice[]
}

type BranchChoice = {
  position: number
  messageId?: string
  timestamp: number
}

type RollTimelineDrawerProps = {
  session: Session
  open: boolean
  onClose: () => void
}

export default function RollTimelineDrawer({ session, open, onClose }: RollTimelineDrawerProps) {
  const { t } = useTranslation()
  const language = useLanguage()
  const nodes = useMemo(() => buildTimelineNodes(session), [session])
  const flatNodes = useMemo(() => flattenNodes(nodes), [nodes])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedNode = useMemo(() => {
    if (!selectedId) {
      return flatNodes[0] ?? null
    }
    return flatNodes.find((node) => node.id === selectedId) ?? flatNodes[0] ?? null
  }, [flatNodes, selectedId])

  const activateNode = useCallback(
    async (node: TimelineNode) => {
      let targetMessageId = node.messageId

      if (node.type === 'branch' && node.forkMessageId && typeof node.branchPosition === 'number') {
        await switchForkToPosition(session.id, node.forkMessageId, node.branchPosition)
        targetMessageId = node.messageId || node.forkMessageId
      } else if (node.branchChoices?.length && node.messageId) {
        const latest = node.branchChoices.reduce((best, item) => (item.timestamp >= best.timestamp ? item : best))
        await switchForkToPosition(session.id, node.messageId, latest.position)
        targetMessageId = latest.messageId || node.messageId
      }

      if (targetMessageId) {
        window.setTimeout(() => {
          void scrollActions.scrollToMessage(session.id, targetMessageId, 'center', 'smooth')
        }, 120)
      }
      onClose()
    },
    [onClose, session.id]
  )

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
          'bg-none box-border max-w-[90vw] w-[420px] flex flex-col gap-0 pt-[var(--mobile-safe-area-inset-top)] pb-[var(--mobile-safe-area-inset-bottom)]',
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

      {selectedNode && (
        <div className="mx-sm my-xs rounded-md border border-solid border-chatbox-border-primary bg-chatbox-background-secondary p-sm">
          <Flex align="center" gap="xs" mb={4}>
            <Badge size="xs" color={selectedNode.type === 'branch' ? 'chatbox-brand' : 'gray'}>
              {selectedNode.type === 'branch' ? t('Branch') : t('Message')}
            </Badge>
            <Text size="xs" c="chatbox-tertiary" lineClamp={1}>
              {selectedNode.meta}
            </Text>
          </Flex>
          <Text size="sm" fw={600} lineClamp={1}>
            {selectedNode.label}
          </Text>
          <Text size="xs" c="chatbox-secondary" mt={4} className="whitespace-pre-wrap break-words">
            {selectedNode.preview || t('No preview')}
          </Text>
        </div>
      )}

      <ScrollArea className="flex-1">
        {nodes.length > 0 ? (
          <div className="py-xs">
            {nodes.map((node) => (
              <TimelineNodeView
                key={node.id}
                node={node}
                selectedId={selectedNode?.id ?? null}
                onSelect={setSelectedId}
                onActivate={activateNode}
              />
            ))}
          </div>
        ) : (
          <Text size="sm" c="chatbox-tertiary" className="px-sm py-md">
            {t('No roll timeline yet')}
          </Text>
        )}
      </ScrollArea>
    </SwipeableDrawer>
  )
}

function TimelineNodeView(props: {
  node: TimelineNode
  selectedId: string | null
  onSelect: (id: string) => void
  onActivate: (node: TimelineNode) => void
}) {
  const { node, selectedId, onSelect, onActivate } = props
  const selected = selectedId === node.id
  const hasChildren = node.children.length > 0
  const icon = node.type === 'branch' ? IconGitBranch : IconMessage

  return (
    <div>
      <Tooltip label={node.meta} withArrow position="left">
        <UnstyledButton
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onActivate(node)}
          className={[
            'w-full box-border text-left px-sm py-xxs transition-colors',
            selected ? 'bg-chatbox-background-brand-secondary' : 'hover:bg-chatbox-background-gray-secondary',
          ].join(' ')}
          style={{ paddingInlineStart: 12 + node.depth * 16 }}
        >
          <Flex align="center" gap="xs" className="min-w-0">
            <ScalableIcon
              icon={icon}
              size={15}
              className={node.type === 'branch' ? 'text-chatbox-tint-brand' : 'text-chatbox-tint-secondary'}
            />
            <Text size="xs" fw={node.type === 'branch' ? 600 : 500} lineClamp={1} className="min-w-0 flex-1">
              {node.label}
            </Text>
            {node.branchCount && (
              <Badge size="xs" variant="light">
                {node.branchCount}
              </Badge>
            )}
            {node.active && (
              <Badge size="xs" color="chatbox-brand" variant="light">
                Current
              </Badge>
            )}
          </Flex>
          {node.preview && (
            <Text size="11px" c="chatbox-tertiary" lineClamp={1} mt={2} className="min-w-0">
              {node.preview}
            </Text>
          )}
        </UnstyledButton>
      </Tooltip>
      {hasChildren && (
        <div className="border-0 border-l border-solid border-chatbox-border-primary ml-md">
          {node.children.map((child) => (
            <TimelineNodeView
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onActivate={onActivate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function buildTimelineNodes(session: Session): TimelineNode[] {
  const messages = getAllMessageList(session)
  if (messages.length === 0) {
    return []
  }
  return buildPath(session, messages, 0, new Set<string>())
}

function buildPath(session: Session, messages: Message[], depth: number, visitedForks: Set<string>): TimelineNode[] {
  const nodes: TimelineNode[] = []
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]
    const fork = session.messageForksHash?.[message.id]
    const node: TimelineNode = {
      id: `message:${message.id}:${depth}`,
      type: 'message',
      label: labelForMessage(message),
      meta: metaForMessage(message),
      preview: previewForMessage(message),
      depth,
      timestamp: message.timestamp,
      messageId: message.id,
      children: [],
    }

    if (fork && fork.lists.length > 1 && !visitedForks.has(message.id)) {
      const nextVisited = new Set(visitedForks)
      nextVisited.add(message.id)
      const currentTail = messages.slice(index + 1)
      const branches = fork.lists.map((list, branchIndex) => {
        const branchMessages = branchIndex === fork.position ? currentTail : list.messages
        const firstMessage = branchMessages[0]
        const latestTimestamp = latestMessageTimestamp(branchMessages) ?? fork.createdAt
        const branchNode: TimelineNode = {
          id: `branch:${message.id}:${list.id}:${branchIndex}`,
          type: 'branch',
          label: `Branch ${branchIndex + 1} / ${fork.lists.length}`,
          meta: `${formatDate(latestTimestamp)} · ${branchMessages.length} messages`,
          preview: previewForMessages(branchMessages),
          depth: depth + 1,
          timestamp: latestTimestamp,
          messageId: firstMessage?.id ?? message.id,
          forkMessageId: message.id,
          branchPosition: branchIndex,
          branchCount: fork.lists.length,
          active: branchIndex === fork.position,
          children: buildPath(session, branchMessages, depth + 2, nextVisited),
        }
        return branchNode
      })

      node.branchCount = fork.lists.length
      node.branchChoices = branches.map((branch) => ({
        position: branch.branchPosition ?? 0,
        messageId: branch.messageId,
        timestamp: branch.timestamp ?? fork.createdAt,
      }))
      node.children = branches
      nodes.push(node)
      return nodes
    }

    nodes.push(node)
  }
  return nodes
}

function flattenNodes(nodes: TimelineNode[]): TimelineNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

function labelForMessage(message: Message) {
  const role = message.role || 'message'
  const text = previewForMessage(message)
  return text ? `${role}: ${text}` : role
}

function metaForMessage(message: Message) {
  return [formatDate(message.timestamp), message.model, message.aiProvider].filter(Boolean).join(' · ')
}

function previewForMessage(message: Message) {
  return trimPreview(getMessageText(message, true, false))
}

function previewForMessages(messages: Message[]) {
  if (messages.length === 0) {
    return 'Empty branch'
  }
  return trimPreview(messages.map((message) => getMessageText(message, true, false)).filter(Boolean).join('\n\n'))
}

function trimPreview(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  return normalized.length > 240 ? `${normalized.slice(0, 240)}...` : normalized
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
