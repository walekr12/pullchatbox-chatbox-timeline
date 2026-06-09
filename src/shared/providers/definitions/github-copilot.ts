import { createBearerOAuthFetch, createOAuthCredentialManager } from '../../oauth'
import { ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import OpenAI from './models/openai'

export const GITHUB_COPILOT_PROVIDER_ID = 'github-copilot'
export const GITHUB_COPILOT_API_HOST = 'https://api.githubcopilot.com'

export const githubCopilotProvider = defineProvider({
  id: GITHUB_COPILOT_PROVIDER_ID,
  name: 'GitHub Copilot',
  type: ModelProviderType.OpenAI,
  urls: {
    website: 'https://github.com/features/copilot',
    docs: 'https://docs.github.com/copilot',
  },
  defaultSettings: {
    activeAuthMode: 'oauth',
    apiHost: GITHUB_COPILOT_API_HOST,
    models: [
      {
        modelId: 'gpt-4o',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 128_000,
        maxOutput: 16_384,
      },
      {
        modelId: 'claude-3.5-sonnet',
        capabilities: ['vision', 'tool_use'],
        contextWindow: 200_000,
        maxOutput: 8_192,
      },
      {
        modelId: 'o3-mini',
        capabilities: ['reasoning'],
        contextWindow: 200_000,
        maxOutput: 100_000,
      },
    ],
  },
  createModel: (config) => {
    const isOAuth = config.providerSetting.activeAuthMode === 'oauth' && !!config.providerSetting.oauth?.accessToken
    const credentialManager = createOAuthCredentialManager(
      GITHUB_COPILOT_PROVIDER_ID,
      config.providerSetting,
      config.dependencies
    )

    return new OpenAI(
      {
        apiKey: isOAuth ? 'oauth-placeholder' : config.effectiveApiKey,
        apiHost: config.formattedApiHost || GITHUB_COPILOT_API_HOST,
        model: config.model,
        dalleStyle: 'vivid',
        temperature: config.settings.temperature,
        topP: config.settings.topP,
        maxOutputTokens: config.settings.maxTokens,
        injectDefaultMetadata: config.globalSettings.injectDefaultMetadata,
        useProxy: config.providerSetting.useProxy || false,
        stream: config.settings.stream,
        customFetch:
          isOAuth && credentialManager ? createBearerOAuthFetch(config.dependencies, credentialManager) : undefined,
        listModelsFallback: config.providerSetting.models || githubCopilotProvider.defaultSettings?.models,
      },
      config.dependencies
    )
  },
})
