/**
 * ResponseFormatter Feature Tests
 */

import { describe, it, expect } from '@jest/globals';
import { ResponseFormatter } from '../src/utils/responseFormatter.js';

describe('ResponseFormatter Core Features', () => {

  it('should format success messages with length limits', () => {
    const longMessage = 'A'.repeat(300);
    const result = ResponseFormatter.success(longMessage, { maxLength: 100 });
    
    expect(result).toContain('✅');
    expect(result.length).toBeLessThanOrEqual(104); // ✅ + 3 dots
    expect(result).toContain('...');
  });

  it('should format error messages with suggestions', () => {
    const suggestions = ['mpcm-pro', 'mpcm-chat'];
    const result = ResponseFormatter.error('Project not found', suggestions);
    
    expect(result).toContain('❌ Project not found');
    expect(result).toContain('💡 Try: mpcm-pro, mpcm-chat');
  });

  it('should format role switch responses concisely', () => {
    const result = ResponseFormatter.roleSwitch(
      'Software Developer',
      'mpcm-pro', 
      'developer',
      { verbose: false }
    );
    
    expect(result).toContain('✅ Switched to Software Developer');
    expect(result).toContain('💻 Focus:');
    expect(result.length).toBeLessThan(150);
  });

  it('should format role switch responses verbosely when requested', () => {
    const result = ResponseFormatter.roleSwitch(
      'Software Developer',
      'mpcm-pro',
      'developer', 
      { verbose: true }
    );
    
    expect(result).toContain('✅ Switched to Software Developer');
    expect(result).toContain('💻 **Software Developer**');
    expect(result).toContain('• Feature implementation');
    expect(result.length).toBeGreaterThan(200);
  });

  it('should format memory reports', () => {
    const stats = { totalEntries: 1250, totalSize: 2048000, saved: 512000 };
    
    const unoptimized = ResponseFormatter.memoryReport(stats, false);
    expect(unoptimized).toContain('📊 Memory: 1250 entries, 2000KB');
    
    const optimized = ResponseFormatter.memoryReport(stats, true);
    expect(optimized).toContain('🔄 Memory optimized');
    expect(optimized).toContain('saved 500KB');
  });

  it('should handle unknown roles gracefully', () => {
    const result = ResponseFormatter.roleSwitch(
      'Custom Role',
      'test-project',
      'unknown-role',
      { verbose: false }
    );
    
    expect(result).toContain('🎯 Focus: Domain expertise');
  });
});
