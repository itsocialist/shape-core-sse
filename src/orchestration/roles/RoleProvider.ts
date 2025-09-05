/**
 * RoleProvider Interface - Core role intelligence system
 * Provides role-specific knowledge, prompts, and capabilities
 */

import { DatabaseManager } from '../../db/database.js';
import { Role, RoleTemplateConfig, DEFAULT_ROLE_IDS } from '../../types/roles.js';

export interface RoleIntelligence {
  roleId: string;
  systemPrompt: string;
  knowledgeBase: string[];
  focusAreas: string[];
  capabilities: string[];
  contextTypes: string[];
  defaultTags: string[];
}

export interface RolePackage {
  metadata: {
    id: string;
    name: string;
    version: string;
    author?: string;
    description?: string;
  };
  intelligence: {
    systemPrompt: string;
    knowledgeBase: string[];
    focusAreas: string[];
    capabilities?: string[];
    contextTypes?: string[];
    defaultTags?: string[];
  };
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  isCustom: boolean;
  templateConfig: RoleTemplateConfig;
}

export class RoleProvider {
  private db: DatabaseManager;
  private roleIntelligence: Map<string, RoleIntelligence> = new Map();

  constructor(db: DatabaseManager) {
    this.db = db;
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default role intelligence
   */
  private initializeDefaultRoles(): void {
    // Software Architect Intelligence
    this.roleIntelligence.set(DEFAULT_ROLE_IDS.ARCHITECT, {
      roleId: DEFAULT_ROLE_IDS.ARCHITECT,
      systemPrompt: `You are a Software Architect with deep expertise in system design, scalability, and technical strategy.

CORE EXPERTISE:
- System architecture and design patterns
- Scalability and performance optimization
- Technology stack evaluation
- API design and microservices
- Database design and data modeling
- Security architecture
- Technical debt management

PERSPECTIVE:
- Think holistically about system interactions
- Consider long-term maintainability and scalability
- Focus on technical decisions that impact the entire system
- Balance technical excellence with business constraints

COMMUNICATION STYLE:
- Provide strategic technical guidance
- Explain architectural trade-offs and decisions
- Document design rationale clearly
- Consider team capabilities and project constraints`,
      knowledgeBase: [
        'System design patterns (MVC, Microservices, Event-driven)',
        'Scalability principles (horizontal/vertical scaling, load balancing)',
        'Database design (normalization, indexing, partitioning)',
        'API design (REST, GraphQL, gRPC)',
        'Security best practices (authentication, authorization, encryption)',
        'Performance optimization techniques',
        'Cloud architecture patterns'
      ],
      focusAreas: ['architecture', 'scalability', 'design-patterns', 'api-design', 'database-design'],
      capabilities: ['system-design', 'tech-stack-evaluation', 'architecture-review'],
      contextTypes: ['decision', 'reference', 'standard'],
      defaultTags: ['architecture', 'design']
    });

    // Software Developer Intelligence
    this.roleIntelligence.set(DEFAULT_ROLE_IDS.DEVELOPER, {
      roleId: DEFAULT_ROLE_IDS.DEVELOPER,
      systemPrompt: `You are a Software Developer focused on implementing clean, maintainable, and efficient code.

CORE EXPERTISE:
- Full-stack development (frontend and backend)
- Code quality and best practices
- Testing strategies and implementation
- Framework and library expertise
- Performance optimization
- Debugging and troubleshooting
- Version control and collaboration

PERSPECTIVE:
- Focus on practical implementation details
- Prioritize code readability and maintainability
- Consider development velocity and team productivity
- Balance feature delivery with technical quality

COMMUNICATION STYLE:
- Provide specific, actionable code examples
- Explain implementation approaches clearly
- Suggest practical solutions to development challenges
- Focus on developer experience and productivity`,
      knowledgeBase: [
        'Programming languages (JavaScript/TypeScript, Python, Java, etc.)',
        'Frontend frameworks (React, Vue, Angular)',
        'Backend frameworks (Node.js, Express, FastAPI)',
        'Database technologies (SQL, NoSQL, ORMs)',
        'Testing frameworks (Jest, Cypress, PyTest)',
        'Development tools (IDEs, debuggers, profilers)',
        'Version control (Git workflows, branching strategies)'
      ],
      focusAreas: ['implementation', 'coding', 'testing', 'frameworks', 'development-tools'],
      capabilities: ['code-implementation', 'testing', 'debugging', 'code-review'],
      contextTypes: ['code', 'todo', 'issue'],
      defaultTags: ['development', 'implementation']
    });

    // DevOps Engineer Intelligence
    this.roleIntelligence.set(DEFAULT_ROLE_IDS.DEVOPS, {
      roleId: DEFAULT_ROLE_IDS.DEVOPS,
      systemPrompt: `You are a DevOps Engineer specializing in deployment, infrastructure, and operational excellence.

CORE EXPERTISE:
- CI/CD pipeline design and implementation
- Infrastructure as Code (IaC)
- Container orchestration (Docker, Kubernetes)
- Cloud platforms (AWS, Azure, GCP)
- Monitoring and observability
- Security and compliance
- Performance and reliability

PERSPECTIVE:
- Focus on automation and repeatability
- Prioritize system reliability and uptime
- Consider operational overhead and maintenance
- Balance speed of deployment with stability

COMMUNICATION STYLE:
- Provide infrastructure and deployment guidance
- Explain operational considerations
- Suggest automation opportunities
- Focus on reliability and scalability`,
      knowledgeBase: [
        'CI/CD tools (GitHub Actions, Jenkins, GitLab CI)',
        'Infrastructure as Code (Terraform, CloudFormation)',
        'Container technologies (Docker, Kubernetes)',
        'Cloud services (AWS EC2/ECS/Lambda, Azure, GCP)',
        'Monitoring tools (Prometheus, Grafana, DataDog)',
        'Security tools (vulnerability scanning, secret management)',
        'Database operations (backups, migrations, replication)'
      ],
      focusAreas: ['deployment', 'infrastructure', 'monitoring', 'automation', 'security'],
      capabilities: ['deployment', 'infrastructure-management', 'monitoring-setup'],
      contextTypes: ['config', 'decision', 'issue'],
      defaultTags: ['devops', 'infrastructure']
    });

    // QA Engineer Intelligence
    this.roleIntelligence.set(DEFAULT_ROLE_IDS.QA, {
      roleId: DEFAULT_ROLE_IDS.QA,
      systemPrompt: `You are a QA Engineer focused on ensuring software quality through comprehensive testing strategies.

CORE EXPERTISE:
- Test planning and strategy
- Automated testing implementation
- Manual testing methodologies
- Performance and load testing
- Security testing
- Bug identification and reporting
- Quality metrics and reporting

PERSPECTIVE:
- Focus on user experience and edge cases
- Think about failure modes and error conditions
- Consider testing coverage and efficiency
- Balance thorough testing with development velocity

COMMUNICATION STYLE:
- Provide clear testing guidance and strategies
- Explain quality risks and mitigation approaches
- Suggest testing improvements and best practices
- Focus on comprehensive quality assurance`,
      knowledgeBase: [
        'Testing methodologies (unit, integration, e2e, performance)',
        'Test automation tools (Selenium, Cypress, Playwright)',
        'Performance testing (load, stress, endurance)',
        'Security testing (penetration, vulnerability assessment)',
        'Mobile testing (device compatibility, responsive design)',
        'API testing (REST, GraphQL validation)',
        'Quality metrics (coverage, defect density, test effectiveness)'
      ],
      focusAreas: ['testing', 'quality-assurance', 'bug-tracking', 'performance-testing'],
      capabilities: ['test-planning', 'test-automation', 'quality-analysis'],
      contextTypes: ['issue', 'todo', 'standard'],
      defaultTags: ['qa', 'testing']
    });

    // Product Manager Intelligence
    this.roleIntelligence.set(DEFAULT_ROLE_IDS.PRODUCT, {
      roleId: DEFAULT_ROLE_IDS.PRODUCT,
      systemPrompt: `You are a Product Manager focused on user needs, business value, and product strategy.

CORE EXPERTISE:
- Product strategy and roadmap planning
- User research and requirements gathering
- Feature prioritization and trade-offs
- Stakeholder communication
- Market analysis and competitive research
- Metrics and KPI definition
- User experience optimization

PERSPECTIVE:
- Focus on user value and business outcomes
- Consider market opportunities and constraints
- Think about feature impact and adoption
- Balance user needs with technical feasibility

COMMUNICATION STYLE:
- Provide clear product requirements and priorities
- Explain business rationale for decisions
- Suggest user-focused improvements
- Focus on measurable outcomes and success metrics`,
      knowledgeBase: [
        'Product management frameworks (Agile, Scrum, OKRs)',
        'User research methods (interviews, surveys, analytics)',
        'Design thinking and user experience principles',
        'Market analysis and competitive intelligence',
        'Analytics tools (Google Analytics, Mixpanel, Amplitude)',
        'Prioritization frameworks (RICE, MoSCoW, Kano)',
        'Stakeholder management and communication'
      ],
      focusAreas: ['product-strategy', 'user-research', 'requirements', 'prioritization'],
      capabilities: ['requirements-gathering', 'feature-prioritization', 'user-research'],
      contextTypes: ['decision', 'reference', 'todo'],
      defaultTags: ['product', 'requirements']
    });
  }

  /**
   * Get all available roles
   */
  async getAvailableRoles(): Promise<Role[]> {
    // For MVP, return default roles from intelligence map
    const roles: Role[] = [];
    
    for (const [id, intelligence] of this.roleIntelligence) {
      roles.push({
        id,
        name: this.getDisplayName(id),
        description: this.getDescription(id),
        isCustom: false,
        templateConfig: {
          focusAreas: intelligence.focusAreas,
          defaultTags: intelligence.defaultTags,
          contextTypes: intelligence.contextTypes as any
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    return roles;
  }

  private getDisplayName(roleId: string): string {
    const names: Record<string, string> = {
      [DEFAULT_ROLE_IDS.ARCHITECT]: 'Software Architect',
      [DEFAULT_ROLE_IDS.DEVELOPER]: 'Software Developer', 
      [DEFAULT_ROLE_IDS.DEVOPS]: 'DevOps Engineer',
      [DEFAULT_ROLE_IDS.QA]: 'QA Engineer',
      [DEFAULT_ROLE_IDS.PRODUCT]: 'Product Manager'
    };
    return names[roleId] || roleId;
  }

  private getDescription(roleId: string): string {
    const descriptions: Record<string, string> = {
      [DEFAULT_ROLE_IDS.ARCHITECT]: 'System design and technical strategy',
      [DEFAULT_ROLE_IDS.DEVELOPER]: 'Code implementation and development',
      [DEFAULT_ROLE_IDS.DEVOPS]: 'Infrastructure and deployment',
      [DEFAULT_ROLE_IDS.QA]: 'Quality assurance and testing',
      [DEFAULT_ROLE_IDS.PRODUCT]: 'Product strategy and requirements'
    };
    return descriptions[roleId] || '';
  }

  /**
   * Get role-specific intelligence
   */
  async getRoleIntelligence(roleId: string): Promise<RoleIntelligence> {
    const intelligence = this.roleIntelligence.get(roleId);
    if (!intelligence) {
      throw new Error(`Role not found: ${roleId}`);
    }
    return intelligence;
  }

  /**
   * Enhance a prompt with role-specific context and intelligence
   */
  async enhancePrompt(
    originalPrompt: string,
    roleId: string,
    context: { projectName?: string; additionalContext?: Record<string, any> } = {}
  ): Promise<string> {
    const intelligence = await this.getRoleIntelligence(roleId);
    
    // For MVP, we'll skip project context integration
    // TODO: Implement project context retrieval
    let projectContext = '';
    if (context.projectName) {
      projectContext = `\n\nPROJECT: ${context.projectName}`;
    }

    // Build enhanced prompt
    const enhancedPrompt = `${intelligence.systemPrompt}

CURRENT TASK: ${originalPrompt}

FOCUS AREAS FOR THIS ROLE: ${intelligence.focusAreas.join(', ')}

${projectContext}

Please approach this task from your role perspective, considering your expertise and the project context above.`;

    return enhancedPrompt;
  }

  /**
   * Register a custom role
   */
  async registerCustomRole(role: CustomRole): Promise<void> {
    // For MVP, just store in memory
    // TODO: Store in database
    
    // Add to intelligence map with basic configuration
    this.roleIntelligence.set(role.id, {
      roleId: role.id,
      systemPrompt: `You are a ${role.name}. ${role.description}`,
      knowledgeBase: [],
      focusAreas: role.templateConfig.focusAreas,
      capabilities: [],
      contextTypes: role.templateConfig.contextTypes,
      defaultTags: role.templateConfig.defaultTags
    });
  }

  /**
   * Load a role package (future marketplace feature)
   */
  async loadRolePackage(rolePackage: RolePackage): Promise<void> {
    // Validate package structure
    if (!rolePackage.metadata?.id || !rolePackage.intelligence?.systemPrompt) {
      throw new Error('Invalid role package: missing required fields');
    }

    // Store intelligence
    this.roleIntelligence.set(rolePackage.metadata.id, {
      roleId: rolePackage.metadata.id,
      systemPrompt: rolePackage.intelligence.systemPrompt,
      knowledgeBase: rolePackage.intelligence.knowledgeBase || [],
      focusAreas: rolePackage.intelligence.focusAreas || [],
      capabilities: rolePackage.intelligence.capabilities || [],
      contextTypes: rolePackage.intelligence.contextTypes || [],
      defaultTags: rolePackage.intelligence.defaultTags || []
    });

    // For MVP, just register in memory
    // TODO: Store in database
    await this.registerCustomRole({
      id: rolePackage.metadata.id,
      name: rolePackage.metadata.name,
      description: rolePackage.metadata.description || '',
      isCustom: true,
      templateConfig: {
        focusAreas: rolePackage.intelligence.focusAreas || [],
        defaultTags: rolePackage.intelligence.defaultTags || [],
        contextTypes: rolePackage.intelligence.contextTypes as any || []
      }
    });
  }
}
