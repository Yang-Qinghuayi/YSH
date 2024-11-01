import { alistGet, alistPost } from '@/util/alistFetch'
import { PEmptyResp, FsGetResp, FsListResp, Obj, PResp, FsSearchResp, RenameObj } from '@/alistTypes'
import { method } from 'lodash-es'

/**
 *
 * 登录
 * @param {string} password
 * @returns {Promise<PEmptyResp>}
 */

export interface LoginResponse {
  /**
   * 状态码
   */
  code: number
  /**
   * data
   */
  data: Data
  /**
   * 信息
   */
  message: string
  [property: string]: any
}

/**
 * data
 */
export interface Data {
  /**
   * token
   */
  token: string
  [property: string]: any
}

export const Login = (username: string, password: string) => {
  return alistPost<LoginResponse>('/auth/login', {
    username,
    password,
  })
}

/**
 *
 * 获取某个文件/目录信息
 * @param {string} path
 * @param {string} password
 *
 */
export const fsGet = (path: string = '/', password = '') => {
  return alistGet<FsGetResp>('/fs/get', {
    params: {
      path,
      password,
    },
  })
}

/**
 * 获取文件列表
 * @param {string} path
 * @returns {Promise<FsGetResp>}
 *
 */

export const fsDirs = (path: string = '/', password = '', force_root = false) => {
  return alistGet<PResp<Obj[]>>('/fs/dirs', {
    params: {
      path,
      password,
      force_root,
    },
  })
}

/**
 * 获取目录
 *
 */
export const fsList = (path: string = '/', password = '', page = 1, per_page = 0, refreah = false) => {
  return alistGet<FsListResp>('/fs/list', {
    params: {
      path,
      password,
      page,
      per_page,
      refreah,
    },
  })
}

/**
 * 获得电影m3u8链接
 *
 */
export interface Data {
  drive_id: string
  file_id: string
  video_preview_play_info: VideoPreviewPlayInfo
}
export interface VideoPreviewPlayInfo {
  category: string
  live_transcoding_task_list: LiveTranscodingTaskList[]
  meta: Meta
}
export interface LiveTranscodingTaskList {
  stage: string
  status: string
  template_height: number
  template_id: string
  template_name: string
  template_width: number
  url: string
}
export interface Meta {
  duration: number
  height: number
  width: number
}
export const fsMovie = (path: string = '/', password = '') => {
  return alistPost<PResp<Data>>('/fs/other', {
    path,
    password,
    method: 'video_preview',
  })
}

/**
 *
 * 取得epub文件
 * @param url
 * @returns
 */

export const fetchText = async (
  url: string,
  ts = true
): Promise<{
  content: ArrayBuffer | string
  url: string
}> => {
  const params = new URLSearchParams({ alist_ts: new Date().getTime().toString() })
  let fullUrl = `${url}&${params.toString()}`
  try {
    const resp = await (await fetch(fullUrl)).blob()
    const content = await resp.arrayBuffer()
    return { content, url: fullUrl }
  } catch (e) {
    console.error('fetchText error:', e)
    return { content: '', url: fullUrl }
  }
}
