import api from './index'
import { Tag } from '../types'

export const getTags = () =>
  api.get<{ data: Tag[] }>('/tags').then(res => res.data.data)
