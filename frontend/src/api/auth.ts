import api from './index'
import type { AuthTokenResponse, AuthUser, LoginRequest, RegisterRequest } from '../types'

export async function registerUser(request: RegisterRequest): Promise<AuthTokenResponse> {
  const res = await api.post('/auth/register', request)
  return res.data.data
}

export async function loginUser(request: LoginRequest): Promise<AuthTokenResponse> {
  const res = await api.post('/auth/login', request)
  return res.data.data
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await api.get('/auth/me')
  return res.data.data
}
