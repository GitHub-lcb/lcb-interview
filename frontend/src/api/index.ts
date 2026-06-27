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
      clearUserToken()
    }
    if (!err.config?.silentGlobalError) {
      emitFeedbackError('网络错误，请稍后重试')
    }
    return Promise.reject(err)
  }
)

export default api
