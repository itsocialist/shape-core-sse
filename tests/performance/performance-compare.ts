/**
 * Performance Regression Detector
 * Compares current performance against baseline
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface Metric {
  duration: number;
  memory: number;
  threshold: number;
}

interface Baseline {
  version: string;
  date: string;
  metrics: Record<string, Metric>;
}

interface ComparisonResult {
  metric: string;
  baseline: number;
  current: number;
  difference: number;
  percentChange: number;
  regression: boolean;
  severity: 'none' | 'minor' | 'major' | 'critical';
}

export class PerformanceComparator {
  private baseline: Baseline;
  
  constructor(baselinePath: string) {
    if (!existsSync(baselinePath)) {
      throw new Error(`Baseline file not found: ${baselinePath}`);
    }
    
    this.baseline = JSON.parse(readFileSync(baselinePath, 'utf-8'));
  }
  
  compare(currentResultsPath: string): ComparisonResult[] {
    const currentResults = JSON.parse(readFileSync(currentResultsPath, 'utf-8'));
    const comparisons: ComparisonResult[] = [];
    
    for (const result of currentResults.results) {
      const baselineMetric = this.baseline.metrics[result.metric];
      if (!baselineMetric) continue;
      
      const difference = result.duration - baselineMetric.duration;
      const percentChange = (difference / baselineMetric.duration) * 100;
      
      comparisons.push({
        metric: result.metric,
        baseline: baselineMetric.duration,
        current: result.duration,
        difference,
        percentChange,
        regression: difference > 0,
        severity: this.getSeverity(percentChange)
      });
    }
    
    return comparisons;
  }
  
  private getSeverity(percentChange: number): ComparisonResult['severity'] {
    if (percentChange <= 0) return 'none';
    if (percentChange < 10) return 'minor';
    if (percentChange < 25) return 'major';
    return 'critical';
  }
  
  generateReport(comparisons: ComparisonResult[]): string {
    const regressions = comparisons.filter(c => c.regression);
    const improvements = comparisons.filter(c => !c.regression && c.difference < 0);
    
    let report = '# Performance Regression Report\n\n';
    report += `Baseline Version: ${this.baseline.version}\n`;
    report += `Baseline Date: ${this.baseline.date}\n\n`;
    
    if (regressions.length === 0) {
      report += '✅ **No performance regressions detected!**\n\n';
    } else {
      report += `⚠️ **${regressions.length} performance regressions detected**\n\n`;
      report += '## Regressions\n\n';
      report += '| Metric | Baseline | Current | Change | Severity |\n';
      report += '|--------|----------|---------|--------|----------|\n';
      
      for (const reg of regressions) {
        const emoji = reg.severity === 'critical' ? '🔴' : 
                      reg.severity === 'major' ? '🟡' : '🟢';
        report += `| ${reg.metric} | ${reg.baseline.toFixed(2)}ms | ${reg.current.toFixed(2)}ms | +${reg.percentChange.toFixed(1)}% | ${emoji} ${reg.severity} |\n`;
      }
    }
    
    if (improvements.length > 0) {
      report += '\n## Improvements\n\n';
      report += '| Metric | Baseline | Current | Change |\n';
      report += '|--------|----------|---------|--------|\n';
      
      for (const imp of improvements) {
        report += `| ${imp.metric} | ${imp.baseline.toFixed(2)}ms | ${imp.current.toFixed(2)}ms | ${imp.percentChange.toFixed(1)}% |\n`;
      }
    }
    
    return report;
  }
}

// CLI usage
if (require.main === module) {
  const baselinePath = join(process.cwd(), 'performance-results', 'baseline.json');
  const latestResults = process.argv[2];
  
  if (!latestResults) {
    console.error('Usage: ts-node performance-compare.ts <results-file>');
    process.exit(1);
  }
  
  try {
    const comparator = new PerformanceComparator(baselinePath);
    const comparisons = comparator.compare(latestResults);
    const report = comparator.generateReport(comparisons);
    
    console.log(report);
    
    // Exit with error code if critical regressions found
    const criticalRegressions = comparisons.filter(c => c.severity === 'critical');
    if (criticalRegressions.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}
