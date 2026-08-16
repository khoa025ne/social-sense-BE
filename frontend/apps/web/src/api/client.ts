const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://truthful-youth-production-d00b.up.railway.app"

type RequestConfig = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  isFormData?: boolean
}

/**
 * Core API client with JWT interceptor and auto-refresh
 */
class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  private getToken(): string | null {
    try {
      const authData = localStorage.getItem("auth-storage")
      if (!authData) return null
      const parsed = JSON.parse(authData)
      return parsed?.state?.accessToken || null
    } catch {
      return null
    }
  }

  private getRefreshToken(): string | null {
    try {
      const authData = localStorage.getItem("auth-storage")
      if (!authData) return null
      const parsed = JSON.parse(authData)
      return parsed?.state?.refreshToken || null
    } catch {
      return null
    }
  }

  private setTokens(accessToken: string, refreshToken: string) {
    try {
      const authData = localStorage.getItem("auth-storage")
      if (authData) {
        const parsed = JSON.parse(authData)
        parsed.state.accessToken = accessToken
        parsed.state.refreshToken = refreshToken
        localStorage.setItem("auth-storage", JSON.stringify(parsed))
      }
    } catch {
      // ignore
    }
  }

  private async refreshAccessToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken()
    if (!refreshToken) return false

    try {
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) return false

      const data = await res.json()
      this.setTokens(data.accessToken, data.refreshToken)
      return true
    } catch {
      return false
    }
  }

  async request<T>(endpoint: string, config?: RequestConfig): Promise<T> {
    const { method = "GET", body, headers = {}, isFormData = false } = config || {}

    const token = this.getToken()
    const requestHeaders: Record<string, string> = {
      ...headers,
    }

    if (token) {
      requestHeaders["Authorization"] = `Bearer ${token}`
    }

    if (!isFormData) {
      requestHeaders["Content-Type"] = "application/json"
    }

    const fetchOptions: RequestInit = {
      method,
      headers: requestHeaders,
    }

    if (body) {
      fetchOptions.body = isFormData ? (body as FormData) : JSON.stringify(body)
    }

    let res = await fetch(`${this.baseUrl}${endpoint}`, fetchOptions)

    // Auto-refresh on 401
    if (res.status === 401 && token) {
      const refreshed = await this.refreshAccessToken()
      if (refreshed) {
        const newToken = this.getToken()
        if (newToken) {
          requestHeaders["Authorization"] = `Bearer ${newToken}`
        }
        res = await fetch(`${this.baseUrl}${endpoint}`, {
          ...fetchOptions,
          headers: requestHeaders,
        })
      }
    }

    if (!res.ok) {
      let errorData: { code?: string; message?: string } = {}
      try {
        errorData = await res.json()
      } catch {
        // ignore parse errors
      }
      throw new ApiError(
        res.status,
        errorData.code || "UNKNOWN_ERROR",
        errorData.message || `Request failed with status ${res.status}`
      )
    }

    // Handle no-content responses
    if (res.status === 204) return {} as T

    // Handle file downloads (blob)
    const contentType = res.headers.get("content-type")
    if (contentType && !contentType.includes("application/json")) {
      return (await res.blob()) as unknown as T
    }

    return await res.json()
  }

  get<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "GET" })
  }

  post<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: "POST", body })
  }

  put<T>(endpoint: string, body?: unknown) {
    return this.request<T>(endpoint, { method: "PUT", body })
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: "DELETE" })
  }

  upload<T>(endpoint: string, formData: FormData) {
    return this.request<T>(endpoint, {
      method: "POST",
      body: formData,
      isFormData: true,
    })
  }
}

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export const api = new ApiClient(API_BASE_URL)
