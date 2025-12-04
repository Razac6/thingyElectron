export interface StorageData {
  id: string;
  name: string;
}

export interface StorageResponse {
  status: 'success' | 'failure';
  data?: StorageData[];
  error?: string;
}
