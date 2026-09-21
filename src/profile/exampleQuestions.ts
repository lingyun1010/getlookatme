import type { Education, Experience, Project, SkillGroup } from './types.ts'

export interface ExampleQuestionProfile {
  preferredName: string
  projects: Project[]
  skills: SkillGroup[]
  experience: Experience[]
  education: Education[]
}

export function generateExampleQuestions(profile: ExampleQuestionProfile): string[] {
  const name = profile.preferredName.trim() || 'this professional'
  const questions: string[] = []
  const project = profile.projects[0]
  const skills = profile.skills.flatMap(({ items }) => items).filter(Boolean).slice(0, 2)
  const experience = profile.experience[0]
  const education = profile.education[0]

  if (project) questions.push(`Tell me about ${project.title}.`)
  if (skills.length) questions.push(`What experience does ${name} have with ${skills.join(' and ')}?`)
  if (experience) questions.push(`What did ${name} do as ${experience.role} at ${experience.company}?`)
  if (education) questions.push(`How does ${name}'s ${education.degree} relate to their work?`)
  if (profile.projects.length > 1) questions.push(`Which of ${name}'s projects best demonstrates their strengths?`)

  const fallbacks = [
    `What is ${name}'s professional background?`,
    `What roles best match ${name}'s experience?`,
    `What are ${name}'s strongest technical skills?`,
  ]
  for (const question of fallbacks) if (questions.length < 3) questions.push(question)
  return [...new Set(questions)].slice(0, 5)
}
