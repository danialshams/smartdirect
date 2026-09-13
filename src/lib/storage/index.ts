export type StorageUploadInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export type StorageUploadResult = {
  storageKey: string;
  publicUrl: string;
};

export interface StorageProvider {
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;

  delete(storageKey: string): Promise<void>;

  exists(storageKey: string): Promise<boolean>;
}
