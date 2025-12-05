import { Buffer } from 'buffer';
import yauzl, { Entry, ZipFile } from 'yauzl';

export type ZipEntryType = 'text' | 'arraybuffer' | 'uint8array' | 'blob';

export interface StreamedZipEntry {
  name: string;
  dir: boolean;
  async(type: ZipEntryType | 'blob'): Promise<string | ArrayBuffer | Uint8Array | Blob>;
}

export interface ZipEntryLike {
  name: string;
  dir: boolean;
  async(type: string): Promise<unknown>;
}

export interface StreamedZipFolder {
  filter(predicate: (path: string, file: StreamedZipEntry) => boolean): StreamedZipEntry[];
  file(path: string): StreamedZipEntry | null;
  readonly root?: string;
}

export interface ZipFolderLike {
  filter(predicate: (path: string, file: ZipEntryLike) => boolean): ZipEntryLike[];
  file(path: string): ZipEntryLike | null;
  readonly root?: string;
}

export interface ZipContainer {
  file(path: string): ZipEntryLike | null;
  folder(path: string): ZipFolderLike | null;
}

export class StreamedZip implements ZipContainer {
  private constructor(
    private readonly zipFile: ZipFile,
    private readonly entries: Map<string, Entry>,
  ) {}

  static async fromArrayBuffer(buffer: ArrayBuffer): Promise<StreamedZip> {
    const zipFile = await new Promise<ZipFile>((resolve, reject) => {
      yauzl.fromBuffer(Buffer.from(buffer), { lazyEntries: true }, (err, zip) => {
        if (err || !zip) {
          reject(err ?? new Error('Unable to open archive'));
          return;
        }
        resolve(zip);
      });
    });

    const entries = new Map<string, Entry>();

    await new Promise<void>((resolve, reject) => {
      zipFile.on('entry', (entry: Entry) => {
        entries.set(entry.fileName, entry);
        zipFile.readEntry();
      });
      zipFile.once('end', () => resolve());
      zipFile.once('error', (err) => reject(err));
      zipFile.readEntry();
    });

    return new StreamedZip(zipFile, entries);
  }

  entries(): StreamedZipEntry[] {
    return Array.from(this.entries.values()).map((entry) => this.wrapEntry(entry));
  }

  file(path: string): StreamedZipEntry | null {
    const entry = this.entries.get(path);
    if (!entry) {
      return null;
    }
    return this.wrapEntry(entry);
  }

  folder(prefix: string): ZipFolderLike | null {
    const normalized = prefix.endsWith('/') ? prefix : `${prefix}/`;
    const matches = Array.from(this.entries.values()).filter((entry) =>
      entry.fileName.startsWith(normalized),
    );
    if (matches.length === 0) {
      return null;
    }

    const root = normalized;
    return {
      root,
      filter: (predicate) =>
        matches
          .filter((entry) => predicate(entry.fileName, this.wrapEntry(entry)))
          .map((entry) => this.wrapEntry(entry)),
      file: (path: string) => this.file(`${normalized}${path}`),
    } satisfies StreamedZipFolder;
  }

  private wrapEntry(entry: Entry): StreamedZipEntry {
    return {
      name: entry.fileName,
      dir: /\/$/.test(entry.fileName),
      async: async (type: ZipEntryType) => {
        const data = await this.readEntry(entry);
        switch (type) {
          case 'text':
            return new TextDecoder().decode(data);
          case 'arraybuffer':
            return data.buffer.slice(
              data.byteOffset,
              data.byteOffset + data.byteLength,
            );
          case 'uint8array':
            return data;
          case 'blob':
          default:
            return new Blob([data]);
        }
      },
    };
  }

  private async readEntry(entry: Entry): Promise<Uint8Array> {
    return new Promise<Uint8Array>((resolve, reject) => {
      this.zipFile.openReadStream(entry, (err, stream) => {
        if (err || !stream) {
          reject(err ?? new Error('Unable to read entry'));
          return;
        }

        const chunks: Uint8Array[] = [];
        stream.on('data', (chunk: Buffer) => {
          chunks.push(new Uint8Array(chunk));
        });
        stream.once('error', (error) => reject(error));
        stream.once('end', () => {
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
          const merged = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.byteLength;
          }
          resolve(merged);
        });
      });
    });
  }
}
