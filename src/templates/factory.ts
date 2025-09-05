/**
 * Factory for creating configured template registry
 * Includes built-in templates for MVP
 */

import { TemplateRegistry } from './TemplateRegistry.js';
import { Template, TEMPLATE_CATEGORIES, TEMPLATE_FRAMEWORKS } from './types.js';

/**
 * Create a template registry with built-in templates
 */
export function createTemplateRegistry(): TemplateRegistry {
  const registry = new TemplateRegistry();
  
  // Register built-in templates
  registerBuiltInTemplates(registry);
  
  return registry;
}

/**
 * Register built-in templates for Sprint 2 MVP
 */
function registerBuiltInTemplates(registry: TemplateRegistry): void {
  // Next.js SaaS Starter Template
  const nextjsSaasTemplate: Template = {
    id: 'nextjs-saas-starter',
    name: 'Next.js SaaS Starter',
    description: 'Full-stack SaaS application with authentication, payments, and multi-tenancy',
    version: '1.0.0',
    author: 'MPCM Team',
    category: TEMPLATE_CATEGORIES.SAAS,
    tags: ['nextjs', 'typescript', 'saas', 'stripe', 'auth', 'prisma'],
    framework: TEMPLATE_FRAMEWORKS.NEXTJS,
    
    dependencies: ['stripe-integration', 'auth0-setup', 'database-setup'],
    environmentVars: {
      required: ['DATABASE_URL', 'NEXTAUTH_SECRET', 'STRIPE_SECRET_KEY'],
      optional: ['STRIPE_WEBHOOK_SECRET', 'AUTH0_SECRET', 'ANALYTICS_ID']
    },
    
    deploymentConfig: {
      supportedPlatforms: ['vercel', 'netlify'],
      preferredPlatform: 'vercel',
      buildCommand: 'npm run build',
      environmentTypes: ['preview', 'production']
    },
    
    roleWorkflows: {
      architect: {
        steps: [
          'review_saas_requirements',
          'design_database_schema',
          'plan_authentication_flow',
          'design_payment_integration'
        ],
        outputs: ['architecture_doc', 'database_schema', 'auth_flow_diagram']
      },
      developer: {
        steps: [
          'setup_nextjs_project',
          'implement_authentication',
          'build_user_dashboard',
          'integrate_stripe_payments',
          'implement_api_routes',
          'write_unit_tests'
        ],
        outputs: ['src/', 'pages/api/', 'components/', '__tests__/']
      },
      devops: {
        steps: [
          'configure_vercel_deployment',
          'setup_database_migrations',
          'configure_environment_variables',
          'setup_monitoring_alerts',
          'configure_ci_cd_pipeline'
        ],
        outputs: ['vercel.json', 'migrations/', '.env.example', '.github/workflows/']
      }
    },
    
    files: [
      {
        path: 'package.json',
        type: 'json',
        template: true,
        content: JSON.stringify({
          name: '{{projectName}}',
          version: '0.1.0',
          description: '{{description}}',
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            test: 'jest',
            'test:watch': 'jest --watch'
          },
          dependencies: {
            'next': '^14.0.0',
            'react': '^18.0.0',
            'react-dom': '^18.0.0',
            '@prisma/client': '^5.0.0',
            'next-auth': '^4.0.0',
            'stripe': '^14.0.0'
          },
          devDependencies: {
            '@types/node': '^20.0.0',
            '@types/react': '^18.0.0',
            'typescript': '^5.0.0',
            'prisma': '^5.0.0',
            'jest': '^29.0.0'
          }
        }, null, 2)
      },
      {
        path: 'src/app/layout.tsx',
        type: 'tsx',
        template: true,
        content: `import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: '{{projectName}}',
  description: '{{description}}',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`
      },
      {
        path: 'README.md',
        type: 'md',
        template: true,
        content: `# {{projectName}}

{{description}}

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Setup environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

3. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

## Features

- 🔐 Authentication with NextAuth.js
- 💳 Stripe payment integration
- 🗄️ Database with Prisma
- 🎨 Tailwind CSS styling
- 📱 Responsive design
- 🧪 Testing with Jest

## Deployment

Deploy to Vercel with one click:
[Deploy](https://vercel.com/new)
`
      }
    ]
  };

  // Landing Page Template
  const landingPageTemplate: Template = {
    id: 'nextjs-landing-page',
    name: 'Next.js Landing Page',
    description: 'Modern, responsive landing page with conversion optimization',
    version: '1.0.0',
    author: 'MPCM Team',
    category: TEMPLATE_CATEGORIES.LANDING,
    tags: ['nextjs', 'landing', 'marketing', 'responsive', 'seo'],
    framework: TEMPLATE_FRAMEWORKS.NEXTJS,
    
    dependencies: ['analytics-setup'],
    environmentVars: {
      required: [],
      optional: ['ANALYTICS_ID', 'HOTJAR_ID', 'MAILCHIMP_API_KEY']
    },
    
    deploymentConfig: {
      supportedPlatforms: ['vercel', 'netlify'],
      preferredPlatform: 'vercel',
      buildCommand: 'npm run build',
      environmentTypes: ['preview', 'production']
    },
    
    roleWorkflows: {
      designer: {
        steps: [
          'create_wireframes',
          'design_visual_identity',
          'create_responsive_layouts',
          'optimize_for_conversion'
        ],
        outputs: ['wireframes/', 'design_system/', 'responsive_mockups/']
      },
      developer: {
        steps: [
          'setup_nextjs_project',
          'implement_responsive_design',
          'add_animations_interactions',
          'optimize_performance',
          'implement_seo_optimization'
        ],
        outputs: ['src/', 'components/', 'styles/']
      },
      marketing: {
        steps: [
          'setup_analytics_tracking',
          'configure_conversion_tracking',
          'setup_email_capture',
          'create_ab_testing_framework'
        ],
        outputs: ['analytics_config/', 'conversion_funnels/', 'email_templates/']
      }
    },
    
    files: [
      {
        path: 'package.json',
        type: 'json',
        template: true,
        content: JSON.stringify({
          name: '{{projectName}}',
          version: '0.1.0',
          description: '{{description}}',
          scripts: {
            dev: 'next dev',
            build: 'next build',
            start: 'next start',
            lint: 'next lint'
          },
          dependencies: {
            'next': '^14.0.0',
            'react': '^18.0.0',
            'react-dom': '^18.0.0',
            'framer-motion': '^10.0.0'
          },
          devDependencies: {
            '@types/node': '^20.0.0',
            '@types/react': '^18.0.0',
            'typescript': '^5.0.0',
            'tailwindcss': '^3.0.0',
            'autoprefixer': '^10.0.0',
            'postcss': '^8.0.0'
          }
        }, null, 2)
      }
    ]
  };

  registry.register(nextjsSaasTemplate);
  registry.register(landingPageTemplate);
}
