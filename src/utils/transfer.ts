export interface ProgressPayload {
  progress: number;
  total: number;
  transferSpeed: number;
}

export type ProgressHandler = (progress: ProgressPayload) => void;
