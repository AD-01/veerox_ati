import { Injectable } from '@nestjs/common';
import { IStorageService } from '../../application/ports/storage.service.interface';

@Injectable()
export class S3StorageAdapter implements IStorageService {
  // Mock S3 implementation since actual AWS SDK is not integrated yet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async uploadFile(path: string, _buffer: Buffer, _mimeType: string): Promise<string> {
    return `s3://veerox-artifacts/${path}`;
  }

  async getFileUrl(path: string): Promise<string> {
    return `https://s3.amazonaws.com/veerox-artifacts/${path}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteFile(_path: string): Promise<void> {
    // Mock delete logic
    return Promise.resolve();
  }
}
