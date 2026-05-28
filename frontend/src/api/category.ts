import api from './index'
import { Category } from '../types'

export const getCategories = () =>
  api.get<{ data: Category[] }>('/categories').then(res => res.data.data)

export const getCategoryById = (id: number) =>
  api.get<{ data: Category }>(`/categories/${id}`).then(res => res.data.data)
