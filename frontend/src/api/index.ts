import axios from 'axios'
import { emitFeedbackError } from '../utils/feedbackMessage'
import { clearUserToken, readUserToken } from '../utils/authToken'

declare module 'axios' {
  export interface AxiosRequestConfig {
    silentGlobalError?: boolean
  }
}

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken')
  if (token && config.url?.startsWith('/admin/')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const userToken = readUserToken()
  if (userToken && (config.url?.startsWith('/tools/') || config.url === '/auth/me')) {
    config.headers.Authorization = `Bearer ${userToken}`
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (res.data.code !== 200) {
      if (!res.config.silentGlobalError) {
        emitFeedbackError(res.data.message || '请求失败')
      }
      return Promise.reject(new Error(res.data.message))
    }
    return res
  },
  (err) => {
    if (err.response?.status === 401) {
      // 区分管理端和用户端 401，分别清除对应 Token
      const url = err.config?.url || ''
      if (url.startsWith('/admin/')) {
        localStorage.removeItem('adminToken')
        // 管理端 401 跳转登录页（避免在已注销状态下持续发送请求）
        if (!window.location.pathname.startsWith('/admin/login')) {
          window.location.href = '/admin/login'
        }
      } else {
        clearUserToken()
      }
    }
    if (!err.config?.silentGlobalError) {
      emitFeedbackError('网络错误，请稍后重试')
    }
    return Promise.reject(err)
  }
)

export default api
