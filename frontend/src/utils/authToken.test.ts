import { beforeEach, describe, expect, it } from 'vitest'
import { clearUserToken, readUserToken, USER_TOKEN_STORAGE_KEY, writeUserToken } from './authToken'

describe('authToken', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stores and reads the ordinary user token', () => {
    writeUserToken('abc')

    expect(readUserToken()).toBe('abc')
    expect(window.localStorage.getItem(USER_TOKEN_STORAGE_KEY)).toBe('abc')
  })

  it('clears the ordinary user token', () => {
    writeUserToken('abc')

    clearUserToken()

    expect(readUserToken()).toBeNull()
  })
})
