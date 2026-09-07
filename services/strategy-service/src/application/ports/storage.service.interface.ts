export interface IStorageService {
  uploadFile(path: string, buffer: Buffer, mimeType: string): Promise<string>;
  getFileUrl(path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
}
