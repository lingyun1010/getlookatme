import type { ProfileDocument } from '../profile/types.ts'
import { contentHash } from './hash.ts'
import type { BuiltKnowledgeSource, KnowledgeMetadata, KnowledgeSourceType } from './types.ts'

function lines(values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value?.trim())).join('\n')
}

function makeSource(sourceType: KnowledgeSourceType, sourceRef: string, title: string, section: string, content: string, metadata: KnowledgeMetadata): BuiltKnowledgeSource {
  const normalizedContent = content.trim()
  return { sourceType, sourceRef, title, section, content: normalizedContent, metadata, contentHash: contentHash({ content: normalizedContent, metadata, title }) }
}

export function buildKnowledgeSources(profile: ProfileDocument): BuiltKnowledgeSource[] {
  const name = profile.identity.fullName
  const sources: BuiltKnowledgeSource[] = [
    makeSource('profile', 'profile', `${name} — Professional profile`, 'profile', lines([
      `Professional profile: ${name}`,
      `Preferred name: ${profile.identity.preferredName}`,
      `Headline: ${profile.identity.headline}`,
      profile.identity.location ? `Location: ${profile.identity.location}` : undefined,
      `Summary: ${profile.identity.summary}`,
      profile.identity.introduction !== profile.identity.summary ? `Introduction: ${profile.identity.introduction}` : undefined,
      profile.focusAreas.length ? `Focus areas: ${profile.focusAreas.join(', ')}` : undefined,
      profile.identity.githubUrl ? `GitHub: ${profile.identity.githubUrl}` : undefined,
      profile.identity.linkedinUrl ? `LinkedIn: ${profile.identity.linkedinUrl}` : undefined,
      profile.identity.websiteUrl ? `Website: ${profile.identity.websiteUrl}` : undefined,
    ]), {
      section: 'profile', evidenceType: 'profile', githubUrl: profile.identity.githubUrl,
      linkedinUrl: profile.identity.linkedinUrl, websiteUrl: profile.identity.websiteUrl,
    }),
  ]

  for (const item of profile.experience) {
    const dates = [item.startDate, item.endDate].filter((date): date is string => Boolean(date))
    sources.push(makeSource('experience', item.id, `${item.role} — ${item.company}`, 'experience', lines([
      `Experience: ${item.role} at ${item.company}.`,
      item.location ? `Location: ${item.location}.` : undefined,
      dates.length ? `Dates: ${dates.join(' to ')}.` : undefined,
      item.summary ? `Summary: ${item.summary}` : undefined,
      item.highlights?.length ? `Highlights:\n${item.highlights.map((value) => `- ${value}`).join('\n')}` : undefined,
      item.technologies?.length ? `Technologies: ${item.technologies.join(', ')}.` : undefined,
    ]), { section: 'experience', evidenceType: 'experience', role: item.role, company: item.company, dates, technologies: item.technologies }))
  }

  for (const item of profile.projects) {
    const links = item.links ?? []
    const githubUrl = links.find(({ label, url }) => /github/i.test(label) || /github\.com/i.test(url))?.url
    const demoUrl = links.find(({ label }) => /demo|live|website/i.test(label))?.url
    sources.push(makeSource('project', item.id, item.title, 'projects', lines([
      `Project: ${item.title}`,
      `Category: ${item.category}`,
      `Description: ${item.shortDescription}`,
      item.description ? `Details: ${item.description}` : undefined,
      item.technologies?.length ? `Technologies: ${item.technologies.join(', ')}.` : undefined,
      item.tags?.length ? `Tags: ${item.tags.join(', ')}.` : undefined,
      links.length ? `Evidence:\n${links.map(({ label, url }) => `- ${label}: ${url}`).join('\n')}` : undefined,
    ]), {
      title: item.title, section: 'projects', evidenceType: 'project', category: item.category,
      skills: item.technologies, urls: links.map(({ url }) => url), githubUrl, demoUrl,
    }))
  }

  for (const item of profile.skills) {
    sources.push(makeSource('skill', item.id, `${item.category} skills`, 'skills',
      `${name}'s ${item.category} skills include ${item.items.join(', ')}.`,
      { section: 'skills', evidenceType: 'skill', category: item.category, skills: item.items }))
  }

  for (const item of profile.education) {
    const dates = [item.startDate, item.endDate].filter((date): date is string => Boolean(date))
    sources.push(makeSource('education', item.id, item.degree, 'education', lines([
      `Education: ${item.degree}${item.institution ? ` at ${item.institution}` : ''}.`,
      dates.length ? `Dates: ${dates.join(' to ')}.` : undefined,
      item.description ? `Details: ${item.description}` : undefined,
      item.honours ? `Honours: ${item.honours}` : undefined,
    ]), { section: 'education', evidenceType: 'education', institution: item.institution, dates }))
  }

  for (const item of profile.services) {
    sources.push(makeSource('service', item.id, item.name, 'services',
      `Service: ${item.name}\nDescription: ${item.description}`,
      { section: 'services', evidenceType: 'service' }))
  }

  for (const item of profile.highlights) {
    sources.push(makeSource('highlight', item.id, item.title, 'highlights',
      `Professional highlight: ${item.title}\nDescription: ${item.description}`,
      { section: 'highlights', evidenceType: 'highlight', anchorId: item.anchorId }))
  }

  return sources
}
