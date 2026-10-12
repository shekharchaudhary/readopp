export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const DOCUMENT_UPLOAD_ACCEPT =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,.pdf,.docx,.txt,.md,.markdown";

export const DOCUMENT_UPLOAD_LABEL =
  "PDF, Word, Markdown, or text · up to 25 MB";

const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "txt",
  "md",
  "markdown",
]);

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
]);

export type DocumentUploadType = "pdf" | "docx" | "text";

export function uploadExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

export function isSupportedDocumentUpload(
  filename: string,
  mimeType = ""
): boolean {
  return (
    SUPPORTED_EXTENSIONS.has(uploadExtension(filename)) ||
    SUPPORTED_MIME_TYPES.has(mimeType.toLowerCase())
  );
}

export function documentUploadType(
  filename: string,
  mimeType = ""
): DocumentUploadType | null {
  const extension = uploadExtension(filename);
  const mime = mimeType.toLowerCase();
  if (extension === "pdf" || mime === "application/pdf") return "pdf";
  if (
    extension === "docx" ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (
    extension === "txt" ||
    extension === "md" ||
    extension === "markdown" ||
    mime === "text/plain" ||
    mime === "text/markdown"
  ) {
    return "text";
  }
  return null;
}

