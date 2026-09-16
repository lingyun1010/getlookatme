import type { ProfileDocument } from '../profile/types.ts'
import type { KnowledgeChunk } from './types.ts'

const compact = (values: Array<string | undefined>) => values.filter(Boolean).join(' | ')

export function buildKnowledgeChunks(profile: ProfileDocument, canonicalProfileKnowledge: string): KnowledgeChunk[] {
  const normalizedProfileKnowledge = canonicalProfileKnowledge.trim()
  if (!normalizedProfileKnowledge) throw new Error('Canonical profile knowledge is required')
  const profileName = profile.identity.fullName

  const chunks: KnowledgeChunk[] = [
    {
      id: 'summary-profile',
      type: 'summary',
      title: `${profileName} — Professional profile`,
      content: normalizedProfileKnowledge,
      metadata: { sourceId: `knowledge/${profile.slug}.md` },
    },
  ]

  for (const skill of profile.skills) {
    chunks.push({
      id: `skill-${skill.id}`,
      type: 'skill',
      title: `${skill.category} skills`,
      content: `${profileName}'s ${skill.category} skills include ${skill.items.join(', ')}.`,
      metadata: { sourceId: skill.id, category: skill.category, technologies: skill.items },
    })
  }

  for (const experience of profile.experience) {
    const dates = [experience.startDate, experience.endDate].filter((date): date is string => Boolean(date))
    chunks.push({
      id: `experience-${experience.id}`,
      type: 'experience',
      title: `${experience.role} — ${experience.company}`,
      content: compact([
        `${profileName} worked as ${experience.role} at ${experience.company}${experience.location ? ` in ${experience.location}` : ''}${dates.length ? ` from ${dates.join(' to ')}` : ''}.`,
        experience.summary,
        experience.highlights?.length ? `Key responsibilities and contributions: ${experience.highlights.join(' ')}` : undefined,
        experience.technologies?.length ? `Technologies: ${experience.technologies.join(', ')}.` : undefined,
      ]),
      metadata: {
        sourceId: experience.id,
        technologies: experience.technologies,
        dates,
      },
    })
  }

  for (const education of profile.education) {
    const dates = [education.startDate, education.endDate].filter((date): date is string => Boolean(date))
    chunks.push({
      id: `education-${education.id}`,
      type: 'education',
      title: education.degree,
      content: compact([
        `${profileName} completed ${education.degree}${education.institution ? ` at ${education.institution}` : ''}${dates.length ? ` from ${dates.join(' to ')}` : ''}.`,
        education.description ? `Area of study or research: ${education.description}.` : undefined,
        education.honours ? `Honours: ${education.honours}.` : undefined,
      ]),
      metadata: { sourceId: education.id, dates },
    })
  }

  for (const project of profile.projects) {
    const urls = project.links?.map((link) => link.url)
    const isAiProject = /\bAI\b|generation/i.test(project.category)
    chunks.push({
      id: `project-${project.id}`,
      type: 'project',
      title: project.title,
      content: compact([
        `Project — ${project.title}`,
        `${project.title} is ${isAiProject ? 'an AI project' : 'a project'} built by ${profileName} in the ${project.category} category.`,
        `Project description: ${project.shortDescription}`,
        project.description ? `Additional project details: ${project.description}` : undefined,
        project.technologies?.length ? `Technologies: ${project.technologies.join(', ')}.` : undefined,
        project.tags?.length ? `Relevant capabilities: ${project.tags.join(', ')}.` : undefined,
        project.links?.length ? `Links: ${project.links.map((link) => `${link.label}: ${link.url}`).join(', ')}.` : undefined,
      ]),
      metadata: { sourceId: project.id, category: project.category, technologies: project.technologies, urls },
    })
  }

  for (const service of profile.services) {
    chunks.push({
      id: `service-${service.id}`,
      type: 'service',
      title: service.name,
      content: `${profileName} offers ${service.name}: ${service.description}`,
      metadata: { sourceId: service.id },
    })
  }

  for (const highlight of profile.highlights) {
    chunks.push({
      id: `highlight-${highlight.id}`,
      type: 'highlight',
      title: highlight.title,
      content: `${profileName}'s ${highlight.title} focus: ${highlight.description}`,
      metadata: { sourceId: highlight.id },
    })
  }

  return chunks
}
