interface FileSystemEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
}

interface FileSystemFileEntry extends FileSystemEntry {
  file: (successCallback: (file: File) => void) => void;
}

interface FileSystemDirectoryEntry extends FileSystemEntry {
  createReader: () => FileSystemDirectoryReader;
}

interface FileSystemDirectoryReader {
  readEntries: (successCallback: (entries: FileSystemEntry[]) => void) => void;
}

type AnyEntry = FileSystemFileEntry | FileSystemDirectoryEntry;

async function traverseEntry(entry: AnyEntry): Promise<File[]> {
  if ("file" in entry) {
    const file: File = await new Promise((resolve) =>
      (entry as FileSystemFileEntry).file(resolve)
    );
    (file as File & { webkitRelativePath?: string }).webkitRelativePath =
      entry.fullPath.replace(/^\//, "");
    return [file];
  }

  if ("createReader" in entry) {
    const dirReader = (entry as FileSystemDirectoryEntry).createReader();
    const entries: AnyEntry[] = await new Promise((resolve) => {
      const all: AnyEntry[] = [];
      const read = () =>
        dirReader.readEntries((batch: FileSystemEntry[]) => {
          const typed = batch as AnyEntry[];
          if (!typed.length) resolve(all);
          else {
            all.push(...typed);
            read();
          }
        });
      read();
    });

    const nested = await Promise.all(entries.map(traverseEntry));
    return nested.flat();
  }

  return [];
}

export function hasExternalFileDrag(event: { dataTransfer?: DataTransfer | null }) {
  return Array.from(event.dataTransfer?.types || []).includes("Files");
}

export async function collectDroppedImageFiles(
  event: { dataTransfer?: DataTransfer | null }
): Promise<File[]> {
  const data = event.dataTransfer;
  if (!data) return [];

  const items = Array.from(data.items || []);
  const entries = items
    .map((item: DataTransferItem) => item.webkitGetAsEntry?.())
    .filter(Boolean) as unknown as AnyEntry[];

  const files = entries.length
    ? (await Promise.all(entries.map(traverseEntry))).flat()
    : Array.from(data.files || []);

  return files.filter((file) => file.type?.startsWith("image/"));
}
