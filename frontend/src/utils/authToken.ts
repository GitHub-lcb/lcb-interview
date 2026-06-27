export const USER_TOKEN_STORAGE_KEY = 'lcb-interview-user-token'

export function readUserToken(): string | null {
  return window.localStorage.getItem(USER_TOKEN_STORAGE_KEY)
}

export function writeUserToken(token: string): void {
  window.localStorage.setItem(USER_TOKEN_STORAGE_KEY, token)
  window.dispatchEvent(new Event('lcb-user-token-change'))
}

export function clearUserToken(): void {
  window.localStorage.removeItem(USER_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event('lcb-user-token-change'))
}
