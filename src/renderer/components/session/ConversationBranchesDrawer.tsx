import { ActionIcon, Badge, Flex, ScrollArea, Text, Tooltip, UnstyledButton } from '@mantine/core'
import SwipeableDrawer from '@mui/material/SwipeableDrawer'
import type { Message, Session } from '@shared/types'
import { getMessageText } from '@shared/utils/message'
import { IconGitBranch, IconX } from '@tabler/icons-react'
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
  label: string
  meta: string
  preview: string
  role: Message['role']
  depth: number
  timestamp?: number
  messageId: string
  editVersions?: Message['editVersions']
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

type ConversationBranchesDrawerProps = {
  session: Session
  open: boolean
  onClose: () => void
}

export default function ConversationBranchesDrawer({ session, open, onClose }: ConversationBranchesDrawerProps) {
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
      if (node.forkMessageId && typeof node.branchPosition === 'number') {
        await switchForkToPosition(session.id, node.forkMessageId, node.branchPosition)
      }

      if (node.branchChoices?.length) {
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

  return (
    <SwipeableDrawer
      anchor={language === 'ar' ? 'left' : 'right'}
      variant="temporary"
      open={open}
      onClose={onClose}
      onOpen={() => undefined}
      title={t('Conversation Branches') || ''}
      ModalProps={{ keepMounted: true }}
      classes={{
        paper:
          'bg-none box-border max-w-[94vw] w-[520px] flex flex-col gap-0 pt-[var(--mobile-safe-area-inset-top)] pb-[var(--mobile-safe-area-inset-bottom)]',
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
            {t('Conversation Branches')}
          </Text>
        </Flex>
        <ActionIcon variant="transparent" color="chatbox-primary" onClick={onClose}>
          <ScalableIcon icon={IconX} size={20} />
        </ActionIcon>
      </Flex>

      {selectedNode && (
        <div className="mx-sm my-xs rounded-md border border-solid border-chatbox-border-primary bg-chatbox-background-secondary p-sm">
          <Flex align="center" gap="xs" mb={4} wrap="wrap">
            <Badge size="xs" color={selectedNode.role === 'user' ? 'blue' : 'chatbox-brand'}>
              {selectedNode.role}
            </Badge>
            {selectedNode.branchLabel && (
              <Badge size="xs" variant="light">
                {selectedNode.branchLabel}
              </Badge>
            )}
            {selectedNode.branchCount && (
              <Badge size="xs" variant="light">
                {selectedNode.branchCount} paths
              </Badge>
            )}
            <Text size="xs" c="chatbox-tertiary" lineClamp={1}>
              {selectedNode.meta}
            </Text>
          </Flex>
          <Text size="xs" c="chatbox-secondary" mt={4} className="whitespace-pre-wrap break-words">
            {selectedNode.preview || t('No preview')}
          </Text>
          {!!selectedNode.editVersions?.length && (
            <Flex gap={6} mt="xs" className="overflow-x-auto pb-1" wrap="nowrap">
              {selectedNode.editVersions.map((version, index) => (
                <Badge key={version.id} size="sm" variant="light" className="max-w-[220px] shrink-0">
                  {`V${index + 1}: ${previewForEditVersion(version) || t('No preview')}`}
                </Badge>
              ))}
            </Flex>
          )}
        </div>
      )}

      <ScrollArea className="flex-1">
        {nodes.length > 0 ? (
          <div className="py-sm pr-xs">
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
            {t('No conversation branches yet')}
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

  return (
    <div>
      <Tooltip label={node.meta} withArrow position="left">
        <UnstyledButton
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => onActivate(node)}
          className={[
            'relative w-full box-border text-left px-sm py-xxs transition-colors',
            selected ? 'bg-chatbox-background-brand-secondary' : 'hover:bg-chatbox-background-gray-secondary',
          ].join(' ')}
          style={{ paddingInlineStart: 16 + node.depth * 30 }}
        >
          <Flex align="center" gap="xs" className="min-w-0">
            {node.depth > 0 && <span className="h-px w-3 shrink-0 bg-chatbox-border-primary" />}
            <MessageMarker node={node} selected={selected} />
            <Text size="xs" fw={node.role === 'user' ? 600 : 500} lineClamp={1} className="min-w-0 flex-1">
              {node.label}
            </Text>
            {node.branchCount && (
              <Badge size="xs" variant="light">
                {node.branchCount}
              </Badge>
            )}
            {!!node.editVersions?.length && (
              <Badge size="xs" variant="light">
                {node.editVersions.length} versions
              </Badge>
            )}
            {node.activeBranch && (
              <Badge size="xs" color="chatbox-brand" variant="light">
                Current
              </Badge>
            )}
          </Flex>

        </UnstyledButton>
      </Tooltip>
      {hasChildren && (
        <div className="border-0 border-l border-solid border-chatbox-border-primary" style={{ marginInlineStart: 25 + node.depth * 30 }}>
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

function MessageMarker({ node, selected }: { node: TimelineNode; selected: boolean }) {
  const roleClass =
    node.role === 'assistant'
      ? 'rounded-full bg-chatbox-tint-brand border-chatbox-tint-brand'
      : node.role === 'user'
        ? 'rounded-[3px] bg-chatbox-background-primary border-chatbox-tint-secondary'
        : 'rotate-45 rounded-[2px] bg-chatbox-background-secondary border-chatbox-border-primary'
  return (
    <span
      className={[
        'h-[18px] w-[18px] shrink-0 border-2 border-solid shadow-sm',
        roleClass,
        selected ? 'ring-2 ring-chatbox-brand ring-offset-1 ring-offset-chatbox-background-primary' : '',
      ].join(' ')}
    />
  )
}

function buildTimelineNodes(session: Session): TimelineNode[] {
  const messages = getAllMessageList(session)
  if (messages.length === 0) {
    return []
  }
  return buildMessagePath(session, messages, 0, 0, undefined, new Set<string>())
}

function buildMessagePath(
  session: Session,
  messages: Message[],
  index: number,
  depth: number,
  branchContext: BranchContext | undefined,
  visitedForks: Set<string>
): TimelineNode[] {
  if (index >= messages.length) {
    return []
  }

  const message = messages[index]
  const fork = session.messageForksHash?.[message.id]
  const node = createMessageNode(message, depth, branchContext)

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
        depth + 1,
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

  node.children = buildMessagePath(session, messages, index + 1, depth, branchContext, visitedForks)
  return [node]
}

function createMessageNode(message: Message, depth: number, branchContext?: BranchContext): TimelineNode {
  return {
    id: ['message', message.id, depth, branchContext?.forkMessageId ?? 'root', branchContext?.branchPosition ?? 'current'].join(':'),
    label: labelForMessage(message),
    meta: metaForMessage(message, branchContext),
    preview: previewForMessage(message),
    role: message.role,
    depth,
    timestamp: message.timestamp,
    messageId: message.id,
    editVersions: message.editVersions,
    forkMessageId: branchContext?.forkMessageId,
    branchPosition: branchContext?.branchPosition,
    branchCount: branchContext?.branchCount,
    activeBranch: branchContext?.activeBranch,
    children: [],
  }
}

function flattenNodes(nodes: TimelineNode[]): TimelineNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)])
}

function labelForMessage(message: Message) {
  const role = message.role || 'message'
  const text = previewForMessage(message)
  return text ? `${role}: ${text}` : role
}

function metaForMessage(message: Message, branchContext?: BranchContext) {
  const branchMeta = branchContext ? `Branch ${branchContext.branchPosition + 1} / ${branchContext.branchCount}` : undefined
  return [branchMeta, formatDate(message.timestamp), message.model, message.aiProvider].filter(Boolean).join(' - ')
}

function previewForMessage(message: Message) {
  return trimPreview(getMessageText(message, true, false))
}

function previewForEditVersion(version: NonNullable<Message['editVersions']>[number]) {
  return trimPreview(
    version.contentParts
      .map((part) => (part.type === 'text' ? part.text : ''))
      .filter(Boolean)
      .join(' ')
  )
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
