// Feature-related type definitions
import { Platform, FeatureCategory } from './index'

export interface Feature {
  platform: Platform
  category: FeatureCategory
  name: string
  enabled: boolean
  loading?: boolean
  output?: any
}

export interface FeatureToggleData {
  platform: Platform
  category: FeatureCategory
  feature: string
  enabled: boolean
  type?: 'logging' | 'monitoring' | 'info'
}

export interface FeatureOutput {
  [platform: string]: {
    [category: string]: {
      [feature: string]: any
    }
  }
}

export interface LoadingState {
  [platform: string]: {
    [category: string]: {
      [feature: string]: boolean
    }
  }
}

// Android-specific feature types
export interface AndroidDeviceInfo {
  androidVersion: string
  sdkVersion: number
  device: string
  manufacturer: string
  model: string
  brand: string
  hardware: string
  product: string
  buildId: string
  fingerprint: string
  bootloader: string
  securityPatch: string
  kernelVersion: string
  cpuArchitecture: string
  cpuCores: number
  totalRAM: string
  availableRAM: string
  totalStorage: string
  availableStorage: string
}

export interface AndroidIPCEvent {
  id: string
  timestamp: string
  type: 'intent' | 'broadcast' | 'content_provider' | 'binder' | 'service'
  action?: string
  component?: string
  data?: any
  extras?: any
  callerPackage?: string
  targetPackage?: string
  method?: string
  uri?: string
  permissions?: string[]
  flags?: number
  stackTrace?: string[]
}

export interface AndroidSSLHook {
  id: string
  library: string
  method: string
  description: string
  enabled: boolean
  bypassActive: boolean
  eventCount: number
  lastEvent?: string
}

export interface AndroidSSLStats {
  totalHooks: number
  activeHooks: number
  bypassedHooks: number
  totalEvents: number
}
