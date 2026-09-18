import { MAX_RESUME_FILE_SIZE } from './defaults.ts'
import type { ExtractedResumeText, ResumeSourceType } from './types.ts'

type FileResumeSourceType = Exclude<ResumeSourceType, 'text'>

export interface ResumeFileLike {
  name: string
  size: number
  type: string
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface DocumentExtractors {
  pdf(buffer: ArrayBuffer): Promise<{ text: string; pageCount?: number; warnings?: string[] }>
  docx(buffer: ArrayBuffer): Promise<{ text: string; warnings?: string[] }>
}

function sourceType(file: ResumeFileLike): FileResumeSourceType | null {
  const extension = file.name.toLowerCase().split('.').pop()
  if (file.type === 'application/pdf' || extension === 'pdf') return 'pdf'
  if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || extension === 'docx') return 'docx'
  return null
}

export function extractedPastedText(text: string): ExtractedResumeText {
  const normalized = text.replace(/\r\n?/g, '\n').trim()
  if (normalized.length < 20) throw new Error('Paste at least 20 characters of resume text.')
  return { text: normalized, sourceType: 'text', metadata: {}, warnings: [] }
}

export async function browserDocumentExtractors(): Promise<DocumentExtractors> {
  return {
    async pdf(buffer) {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
      if (typeof window !== 'undefined') {
        const workerUrl = new URL('/node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs', window.location.origin).href
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
      }
      const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise
      const pages: string[] = []
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        const page = await document.getPage(pageNumber)
        const content = await page.getTextContent()
        pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
      }
      return { text: pages.join('\n'), pageCount: document.numPages }
    },
    async docx(buffer) {
      const mammoth = await import('mammoth/mammoth.browser')
      const result = await mammoth.extractRawText({ arrayBuffer: buffer })
      return { text: result.value, warnings: result.messages.map((item: { message: string }) => item.message) }
    },
  }
}

export async function extractResumeText(file: ResumeFileLike, extractors?: DocumentExtractors): Promise<ExtractedResumeText> {
  const type = sourceType(file)
  if (!type) throw new Error('Choose a PDF or DOCX file.')
  if (file.size <= 0) throw new Error('The selected file is empty.')
  if (file.size > MAX_RESUME_FILE_SIZE) throw new Error('The selected file exceeds the 8 MB limit.')
  const adapters = extractors ?? await browserDocumentExtractors()
  try {
    const result = await adapters[type](await file.arrayBuffer())
    const text = result.text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim()
    if (text.length < 20) throw new Error('Very little readable text was found.')
    const warnings = [...(result.warnings ?? [])]
    if (text.length < 200) warnings.push('The document contains little extractable text; review the result carefully.')
    const pageCount = type === 'pdf' ? (result as { pageCount?: number }).pageCount : undefined
    return {
      text,
      sourceType: type,
      metadata: { fileName: file.name, fileSize: file.size, pageCount },
      warnings,
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown parsing error'
    throw new Error(`Could not extract resume text: ${reason}`)
  }
}
