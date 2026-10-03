import { ResultsExport } from './resultExport';
import { meetingReport } from './meetingReport';
export async function downloadMeetingPdf(
  data: ResultsExport,
  filename: string,
  includePrivate = false,
) {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    import('pdfmake/build/vfs_fonts'),
  ]);
  // pdfmake 0.2.23 exports a flat VFS map; the 0.2 type package describes an older wrapper.
  const vfs = fonts as unknown as Record<string, string>;
  const blob = await new Promise<Blob>((resolve) =>
    pdfMake
      .createPdf(meetingReport(data, includePrivate), undefined, undefined, vfs)
      .getBlob(resolve),
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
