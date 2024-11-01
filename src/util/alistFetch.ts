import type { Options } from './yofetch'
import yofetch from './yofetch'
import { useAlistStore } from '@/store/alist'


const alistService = yofetch.create({
  // @ts-ignore
  baseURL: import.meta.env.VITE_ALIST_API,
  headers: {
    'Content-Type': 'application/json;charset=utf-8',
  },
  // credentials: 'include',
})



// direct return response data
export const alistGet = <T>(url: string | Options, config?: Options) => {
  return alistService.request<T>(url, config, 'get').then((response) => {
    const { data, ok } = response
    const { code, status, body } = data as any
    if(code === 401){
        useAlistStore().setLogged(false)
    }
    // success code is 100 or 200
    if (ok && [100, 200].includes(code)) {
      return data
    } else if (status === 200) {
      return body as T
    } else {
      return Promise.reject(data)
    }
  })
}
export const alistPost = <T>(url: string | Options, body: any, config?: Options) => {
  return alistService.request<T>(url, config, 'post', body).then((response) => {
    const { data, ok } = response
    const { code } = data as any
    // success code is 100 or 200
    if (ok && [100, 200].includes(code)) {
      return data
    } else {
      return Promise.reject(data)
    }
  })
}

export default alistService
