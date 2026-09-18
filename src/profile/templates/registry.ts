export const portfolioTemplates = {
  kinetic: {
    id: 'kinetic',
    label: 'Kinetic',
    rootClass: 'portfolio-template-kinetic',
    stylesheet: '/src/profile/templates/kinetic/kinetic.css',
  },
} as const

export type PortfolioTemplateId = keyof typeof portfolioTemplates

export const defaultPortfolioTemplateId: PortfolioTemplateId = 'kinetic'
