// Services/Frontend/ui/src/components/Frida/Dialogs/FridaClicks/types/index.ts
export interface Platform {
  ios: boolean
  android: boolean
}

export interface FeatureCategory {
  id: string
  title: string
  icon: string
}

export interface Feature {
  platform: 'ios' | 'android'
  category: string
  feature: string
  enabled: boolean
  loading?: boolean
  output?: any
}

export interface FeatureToggleData {
  platform: 'ios' | 'android'
  category: string
  feature: string
  enabled: boolean
  type?: 'logging' | 'monitoring' | 'info'
}

export interface FeatureExecuteData {
  platform: 'ios' | 'android'
  category: string
  feature: string
  action?: string
  data?: any
  output?: any
}

export interface Notification {
  id: number
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  progress: number
}

export interface DialogSize {
  width: number
  height: number
  top: number
  left: number
}

export interface IPCStats {
  totalEvents: number
  byType: {
    intent: number
    broadcast: number
    content_provider: number
    binder: number
    service: number
  }
}

export interface IPCEvent {
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
