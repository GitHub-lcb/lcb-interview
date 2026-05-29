import axios from 'axios'
import { message } from 'antd'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use(config => {
  const token = localStorage.getItem('adminToken')
  if (token && config.url?.startsWith('/admin/')) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => {
    if (res.data.code !== 200) {
      message.error(res.data.message || '请求失败')
      return Promise.reject(new Error(res.data.message))
    }
    return res
  },
  (err) => {
    message.error('网络错误，请稍后重试')
    return Promise.reject(err)
  }
)

export default api
