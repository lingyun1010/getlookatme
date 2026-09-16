import type { ProfileDocument } from '../types.ts'

export const aaronProfile = {
  profileId: 'profile_aaron_fixture',
  slug: 'aaron',
  version: 1,
  identity: {
    fullName: 'Aaron Example',
    preferredName: 'Aaron',
    headline: 'Product Engineer | Fixture Profile',
    location: 'Melbourne, Australia',
    summary: 'Aaron is a fictional fixture profile used to prove that LookAtMe can render distinct professional identities through one shared application.',
    introduction: 'A minimal fixture profile for testing the reusable LookAtMe portfolio renderer.',
    email: 'aaron@example.invalid',
  },
  seo: {
    title: 'Aaron Example — LookAtMe Fixture Profile',
    description: 'A fictional fixture profile used to validate the LookAtMe multi-profile renderer.',
  },
  highlights: [
    {
      id: 'fixture-product-delivery',
      title: 'Product Delivery',
      description: 'A fixture highlight demonstrating that profile-specific content is resolved from structured data.',
    },
  ],
  skills: [
    {
      id: 'fixture-engineering',
      category: 'Engineering',
      items: ['TypeScript', 'Web APIs', 'Testing'],
    },
  ],
  services: [
    {
      id: 'fixture-prototyping',
      name: 'Product Prototyping',
      description: 'Fixture-safe content representing rapid product prototyping and validation.',
    },
  ],
  experience: [
    {
      id: 'fixture-product-engineer',
      role: 'Product Engineer',
      company: 'Example Studio',
      location: 'Melbourne, Australia',
      startDate: '2023',
      endDate: 'Present',
      summary: 'Fixture product engineering experience',
      highlights: ['Built and tested small web product prototypes for demonstration purposes.'],
      technologies: ['TypeScript', 'Web APIs'],
    },
  ],
  education: [
    {
      id: 'fixture-software-degree',
      degree: 'BSc, Software Engineering',
      institution: 'Example University',
      startDate: '2019',
      endDate: '2022',
      description: 'Fixture education record',
    },
  ],
  projects: [
    {
      id: 'fixture-project',
      title: 'Fixture Project',
      category: 'Product prototype',
      shortDescription: 'A fictional project that exercises the shared project-card renderer without representing a real person or product.',
      technologies: ['TypeScript'],
      tags: ['Fixture', 'Prototype'],
    },
  ],
  focusAreas: ['Product engineering', 'TypeScript', 'Prototyping', 'Testing'],
  suggestedQuestions: [
    'What is this fixture profile?',
    'What skills are demonstrated?',
  ],
  avatar: {
    mode: 'placeholder',
    alt: 'Placeholder avatar for the Aaron fixture profile',
    initials: 'AE',
  },
  presentation: { theme: 'default' },
  ai: {
    enabled: false,
    unavailableMessage: 'AI profile not available yet.',
  },
} satisfies ProfileDocument
