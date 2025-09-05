/**
 * Core types for the deployment provider system
 * Defines interfaces for pluggable deployment architecture
 */

import { RoleContext } from '../types/roles.js';

export enum DeploymentStatus {
  PENDING = 'pending',
  BUILDING = 'building',
  READY = 'ready',
  ERROR = 'error',
  CANCELLED = 'cancelled'
}

export interface DeploymentConfig {
  projectPath: string;
  platform: string; // 'vercel' | 'netlify' | 'auto'
  environment: 'preview' | 'production';
  dependencies: string[];
  customConfig?: Record<string, any>;
}

export interface DeploymentCapabilities {
  platform: string;
  supportedFrameworks: string[];
  features: string[];
  environmentTypes: string[];
  maxDeploymentSize: string;
}

export interface DependencyResolution {
  resolved: string[];
  missing: string[];
  conflicts: string[];
  environmentVars: Record<string, string>;
}

export interface DeploymentPreparation {
  configFiles: string[];
  environmentVariables: Record<string, string>;
  buildCommand: string;
  deploymentId: string;
}

export interface DeploymentLog {
  timestamp: Date;
  level: 'info' | 'warn' | 'error';
  message: string;
  source?: string;
}

export interface DeploymentResult {
  deploymentId: string;
  status: DeploymentStatus;
  url: string | null;
  platform: string;
  environment: string;
  createdAt: Date;
  completedAt?: Date;
  logs: DeploymentLog[];
  metadata?: Record<string, any>;
}

export interface DeploymentStatusResponse {
  deploymentId: string;
  status: DeploymentStatus;
  url: string;
  lastUpdated: Date;
  buildLogs: DeploymentLog[];
  progress?: number; // 0-100
}

export interface EnhancedDeploymentConfig extends DeploymentConfig {
  securityHeaders?: Record<string, string>;
  monitoring?: {
    enabled: boolean;
    alerts: string[];
  };
  analytics?: {
    provider: string;
    config: Record<string, any>;
  };
}

/**
 * Core interface that all deployment providers must implement
 */
export interface DeploymentProvider {
  /**
   * Get provider capabilities for selection and validation
   */
  getCapabilities(): DeploymentCapabilities;

  /**
   * Validate deployment configuration
   * @throws Error if configuration is invalid
   */
  validate(config: DeploymentConfig): Promise<void>;

  /**
   * Resolve template dependencies
   */
  resolveDependencies(config: DeploymentConfig): Promise<DependencyResolution>;

  /**
   * Prepare deployment with role-specific enhancements
   */
  prepare(config: DeploymentConfig, roleContext: RoleContext): Promise<DeploymentPreparation>;

  /**
   * Enhance configuration with role-specific context
   */
  enhanceWithRoleContext(
    config: DeploymentConfig,
    roleContext: RoleContext
  ): Promise<EnhancedDeploymentConfig>;

  /**
   * Execute deployment
   */
  deploy(config: DeploymentConfig, roleContext: RoleContext): Promise<DeploymentResult>;

  /**
   * Get deployment status
   */
  getStatus(deploymentId: string): Promise<DeploymentStatusResponse>;

  /**
   * Cancel deployment
   */
  cancel(deploymentId: string): Promise<void>;
}

/**
 * Provider selection and automatic detection
 */
export interface ProviderSelection {
  platform: string;
  confidence: number; // 0-1
  reason: string;
}

export interface DeploymentRegistry {
  register(name: string, provider: DeploymentProvider): void;
  getProvider(name: string): DeploymentProvider;
  selectProvider(config: DeploymentConfig): ProviderSelection;
  listProviders(): string[];
}
