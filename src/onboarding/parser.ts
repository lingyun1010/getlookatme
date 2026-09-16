import type { ExtractedResumeText, ParsedResume, ResumeMappingService } from './types.ts'
import { safeHttpUrl } from './urls.ts'

const SECTION = /^(summary|profile|about|skills|technical skills|experience|employment|work experience|education|projects|selected projects)$/i

function sectionName(line: string): string | null {
  const match = line.replace(/[:\s]+$/, '').match(SECTION)
  return match?.[1].toLowerCase() ?? null
}

function sectionLines(lines: string[], names: string[]): string[] {
  const start = lines.findIndex((line) => names.includes(sectionName(line) ?? ''))
  if (start < 0) return []
  const result: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (sectionName(line)) break
    result.push(line)
  }
  return result
}

function splitRecord(line: string): string[] {
  return line.split(/\s+[|•·]\s+|\s+at\s+/i).map((part) => part.trim()).filter(Boolean)
}

export function parseResumeDeterministically(extracted: ExtractedResumeText): ParsedResume {
  const lines = extracted.text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (!lines.length) throw new Error('No resume text was available to parse.')
  const email = extracted.text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
  const urls = [...extracted.text.matchAll(/https?:\/\/[^\s<>()]+/gi)].map(([value]) => value.replace(/[.,;]+$/, ''))
  const githubUrl = urls.find((url) => /github\.com/i.test(url))
  const linkedinUrl = urls.find((url) => /linkedin\.com/i.test(url))
  const websiteUrl = urls.find((url) => url !== githubUrl && url !== linkedinUrl)
  const nameCandidate = lines.find((line) => !line.includes('@') && !/^https?:/i.test(line) && !SECTION.test(line) && line.length <= 80)
  const summaryLines = sectionLines(lines, ['summary', 'profile', 'about'])
  const skillLines = sectionLines(lines, ['skills', 'technical skills'])
  const experienceLines = sectionLines(lines, ['experience', 'employment', 'work experience'])
  const educationLines = sectionLines(lines, ['education'])
  const projectLines = sectionLines(lines, ['projects', 'selected projects'])
  const experience = experienceLines.filter((line) => !/^[-•]/.test(line)).slice(0, 8).map((line) => {
    const [role = line, company = ''] = splitRecord(line)
    return { role, company }
  }).filter(({ company }) => company)
  const education = educationLines.filter((line) => !/^[-•]/.test(line)).slice(0, 6).map((line) => {
    const [degree = line, institution] = splitRecord(line)
    return { degree, institution }
  })
  const projects = projectLines.filter((line) => !/^[-•]/.test(line)).slice(0, 8).map((line) => ({
    title: splitRecord(line)[0] ?? line,
    category: 'Project',
    shortDescription: line,
  }))
  const warnings = [...extracted.warnings]
  const headline = experience[0]?.role
  if (headline) warnings.push('Headline was inferred from the first detected experience and should be reviewed.')
  if (!nameCandidate) warnings.push('Full name was not confidently detected.')
  return {
    identity: {
      fullName: nameCandidate,
      preferredName: nameCandidate?.split(/\s+/)[0],
      email,
      headline,
    },
    summary: summaryLines.join(' ') || undefined,
    skills: skillLines.flatMap((line) => line.split(/[,;|•]/)).map((item) => item.trim()).filter(Boolean),
    experience,
    education,
    projects,
    links: {
      githubUrl: safeHttpUrl(githubUrl),
      linkedinUrl: safeHttpUrl(linkedinUrl),
      websiteUrl: safeHttpUrl(websiteUrl),
    },
    warnings,
    mapping: {
      mapper: 'deterministic',
      inferredFields: headline ? ['identity.headline'] : [],
      lowConfidenceFields: [],
    },
  }
}

export class DeterministicResumeMappingService implements ResumeMappingService {
  async mapResume(extracted: ExtractedResumeText): Promise<ParsedResume> {
    return parseResumeDeterministically(extracted)
  }
}
