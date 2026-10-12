import JSZip from "jszip";
import type { CleanArticle } from "../shared/schemas";
import type { DocumentUploadType } from "./uploadTypes";

const MIN_DOCUMENT_CHARACTERS = 120;

export async function extractUploadedDocument(input: {
  buffer: Buffer;
  filename: string;
  type: Exclude<DocumentUploadType, "pdf">;
}): Promise<CleanArticle> {
  const rawText =
    input.type === "docx"
      ? await extractDocxText(input.buffer)
      : input.buffer.toString("utf8");
  const text = normalizeDocumentText(rawText);
  if (text.length < MIN_DOCUMENT_CHARACTERS) {
    throw new Error(
      "This document does not contain enough readable text. Try a longer document or export it as PDF."
    );
  }

  return {
    url: `upload://${encodeURIComponent(input.filename)}`,
    title: filenameTitle(input.filename),
    text,
    codeBlocks: input.type === "text" ? markdownCodeBlocks(rawText) : [],
    imageUrls: [],
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("The Word file is damaged or is not a valid .docx document.");
  }
  const documentXml = zip.file("word/document.xml");
  if (!documentXml) {
    throw new Error("The Word file does not contain a readable document body.");
  }
  const xml = await documentXml.async("string");
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\s*\/>/gi, "\t")
      .replace(/<w:br\b[^>]*\/>/gi, "\n")
      .replace(/<\/w:p>/gi, "\n")
      .replace(/<\/w:tr>/gi, "\n")
      .replace(/<w:tc\b[^>]*>/gi, "\t")
      .replace(/<[^>]+>/g, "")
  );
}

function normalizeDocumentText(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_match, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function filenameTitle(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Uploaded document";
}

function markdownCodeBlocks(value: string): string[] {
  return [...value.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean)
    .slice(0, 20);
}

