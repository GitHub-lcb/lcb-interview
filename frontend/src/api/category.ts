import api from './index'
import type { AxiosRequestConfig } from 'axios'
import { Category } from '../types'

export const getCategories = (options: AxiosRequestConfig = {}) =>
  api.get<{ data: Category[] }>('/categories', options).then(res => res.data.data)

export const getCategoryById = (id: number, options: AxiosRequestConfig = {}) =>
  api.get<{ data: Category }>(`/categories/${id}`, options).then(res => res.data.data)
