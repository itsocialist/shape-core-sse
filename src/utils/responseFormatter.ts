/**
 * Optimized tool response formatter for memory efficiency
 */

export interface ResponseOptions {
  verbose?: boolean;
  includeGuidance?: boolean;
  includeDetails?: boolean;
  maxLength?: number;
}

export class ResponseFormatter {
  static success(message: string, options: ResponseOptions = {}): string {
    const { verbose = false, maxLength = 200 } = options;
    
    if (!verbose && message.length > maxLength) {
      const truncated = message.substring(0, maxLength - 3) + '...';
      return `✅ ${truncated}`;
    }
    
    return `✅ ${message}`;
  }

  static error(message: string, suggestions?: string[]): string {
    const base = `❌ ${message}`;
    
    if (suggestions && suggestions.length > 0) {
      const hint = suggestions.slice(0, 2).join(', ');
      return `${base}\n💡 Try: ${hint}`;
    }
    
    return base;
  }

  static roleSwitch(
    roleName: string, 
    projectName: string, 
    roleId: string,
    options: ResponseOptions = {}
  ): string {
    const { verbose = false } = options;
    
    const emoji = this.getRoleEmoji(roleId);
    const base = `✅ Switched to ${roleName} for '${projectName}'`;
    
    if (!verbose) {
      return `${base}\n${emoji} Focus: ${this.getRoleFocus(roleId)}`;
    }
    
    return `${base}\n\n${this.getDetailedGuidance(roleId, roleName)}`;
  }

  static memoryReport(stats: any, optimized = false): string {
    const { totalEntries, totalSize, saved } = stats;
    const sizeKB = Math.round(totalSize / 1024);
    
    if (optimized && saved > 0) {
      const savedKB = Math.round(saved / 1024);
      return `🔄 Memory optimized: ${totalEntries} entries, ${sizeKB}KB (saved ${savedKB}KB)`;
    }
    
    return `📊 Memory: ${totalEntries} entries, ${sizeKB}KB`;
  }

  private static getRoleEmoji(roleId: string): string {
    const emojis: Record<string, string> = {
      'architect': '🏗️',
      'developer': '💻',
      'devops': '🚀', 
      'qa': '🔍',
      'product': '📋'
    };
    return emojis[roleId] || '🎯';
  }

  private static getRoleFocus(roleId: string): string {
    const focus: Record<string, string> = {
      'architect': 'Design • Standards • Decisions',
      'developer': 'Code • Features • Testing',
      'devops': 'Deploy • Infra • Monitor',
      'qa': 'Test • Quality • Bugs', 
      'product': 'Requirements • Roadmap'
    };
    return focus[roleId] || 'Domain expertise';
  }

  private static getDetailedGuidance(roleId: string, roleName: string): string {
    // Full guidance for verbose mode only
    const guidance: Record<string, string> = {
      'architect': `🏗️ **${roleName}**
• System design and architecture decisions  
• Technology evaluation and standards
• Design patterns and constraints
• Technical documentation`,
      
      'developer': `💻 **${roleName}**
• Feature implementation and code development
• Code quality assurance and testing methodologies  
• Debugging complex issues and problem-solving
• Technical documentation and code reviews
• Maintaining clean, maintainable code standards`,
      
      'devops': `🚀 **${roleName}**
• Deployment automation and CI/CD
• Infrastructure and monitoring
• System reliability and performance
• Security and compliance`,
      
      'qa': `🔍 **${roleName}**
• Test planning and strategy
• Quality assurance and bug tracking
• Test automation frameworks
• Quality metrics and reporting`,
      
      'product': `📋 **${roleName}**
• Requirements and user stories
• Product roadmap and priorities
• Stakeholder communication
• User experience and metrics`
    };
    
    return guidance[roleId] || `🎯 **${roleName}**\nSpecialized domain expertise`;
  }
}
