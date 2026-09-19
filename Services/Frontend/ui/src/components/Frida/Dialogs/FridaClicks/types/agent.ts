// Agent-related type definitions
export interface AgentState {
  loaded: boolean
  loading: boolean
  unloading: boolean
  error: string | null
  sessionId: string | null
}

export interface AgentExecuteRequest {
  sessionId: string
  command: string
}

export interface AgentExecuteResponse {
  status: 'success' | 'error'
  result?: any
  output?: string
  message?: string
  error?: string
}

export interface LoadAgentRequest {
  device_id: string
  pid: number
  session_id: string
}

export interface LoadAgentResponse {
  status: 'success' | 'error'
  message?: string
  session_id?: string
}
