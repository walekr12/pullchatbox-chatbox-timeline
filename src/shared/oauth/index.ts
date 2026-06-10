import type { ProviderSettings } from '../types'

/**
 * In the open-source edition OAuth is not available.
 * These stubs keep the provider pipeline working without it.
 */

export interface OAuthCredentials {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  extra?: Record<string, unknown>
}

export const OAuthIpcChannels = {
  LOGIN: 'oauth:login',
  START_LOGIN: 'oauth:start-login',
  EXCHANGE_CODE: 'oauth:exchange-code',
  START_DEVICE_FLOW: 'oauth:start-device-flow',
  WAIT_DEVICE_TOKEN: 'oauth:wait-device-token',
  CANCEL: 'oauth:cancel',
  REFRESH: 'oauth:refresh',
  GET_SUPPORTED_PROVIDERS: 'oauth:get-supported-providers',
} as const

export interface OAuthResult {
  success: boolean
  credentials?: OAuthCredentials
  error?: string
}

export interface OAuthStartResult {
  success: boolean
  authUrl?: string
  instructions?: string
  error?: string
}

export interface DeviceFlowStartResult {
  success: boolean
  userCode?: string
  verificationUri?: string
  error?: string
}

export interface OAuthProviderInfo {
  providerId: string
  name: string
  flowType: 'callback' | 'code-paste' | 'device-code'
}

export function mergeSharedOAuthProviderSettings(
  providerId: string,
  providers: Record<string, ProviderSettings> | undefined
): ProviderSettings {
  return providers?.[providerId] || {}
}

export function resolveEffectiveApiKey(
  providerSetting: ProviderSettings,
  _platformType: string
): string {
  return providerSetting.apiKey || ''
}

export function isUsingOAuth(
  _providerSetting: ProviderSettings,
  _platformType: string
): boolean {
  return false
}

export function isOAuthExpired(_providerSetting: ProviderSettings): boolean {
  return false
}

export function toOAuthProviderId(_chatboxProviderId: string): string | undefined {
  return undefined
}

export function toOAuthSettingsProviderId(_chatboxProviderId: string): string | undefined {
  return undefined
}

// No-op credential manager stub
export function createOAuthCredentialManager(..._args: unknown[]): undefined {
  return undefined
}

// No-op OAuth fetch stubs. They are only called when OAuth is enabled,
// which never happens in the open-source edition.
export function createBearerOAuthFetch(..._args: unknown[]): undefined {
  return undefined
}

export function createOpenAIOAuthFetch(..._args: unknown[]): undefined {
  return undefined
}
