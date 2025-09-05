# MPCM-Pro v0.3.0 QA Test Plan

## Performance Testing Complete ✅

### Baseline Metrics Established
- **Database Initialization**: 2.68ms
- **Server Initialization**: 0.06ms
- **Tool List Request**: 0.27ms
- **Simple Tool Call**: 0.81ms
- **Database Read**: 0.10ms
- **Context Search**: 0.20ms
- **Role Switch**: 1.35ms
- **Concurrent Operations (10)**: 1.06ms
- **Max Memory Delta**: 0.04MB

All operations are extremely fast, well under thresholds!

### Performance Testing Infrastructure
1. ✅ Performance test suite created (`tests/performance/performance.test.ts`)
2. ✅ Performance comparison tool created (`performance-compare.ts`)
3. ✅ GitHub Actions workflow for CI/CD (`performance.yml`)
4. ✅ Baseline metrics saved
5. ✅ NPM scripts added:
   - `npm run test:performance`
   - `npm run perf:baseline`
   - `npm run perf:compare`

## QA Checklist for v0.3.0 Release

### 1. Entry Point Consolidation Testing
- [ ] Verify single entry point works in Pro mode
- [ ] Verify single entry point works in Basic mode
- [ ] Test mode switching via environment variables
- [ ] Confirm all 25 tools are available
- [ ] Test backward compatibility

### 2. Performance Regression Testing
- [ ] Run performance tests on different Node versions (18.x, 20.x)
- [ ] Compare against baseline metrics
- [ ] Test with large datasets (1000+ contexts)
- [ ] Memory leak testing
- [ ] Concurrent request handling

### 3. Integration Testing
- [ ] Test with Claude Desktop in Pro mode
- [ ] Test with Claude Desktop in Basic mode
- [ ] Verify Git MCP integration
- [ ] Verify filesystem adapter
- [ ] Test role switching under load

### 4. Migration Testing
- [ ] Test upgrade from v0.2.x to v0.3.0
- [ ] Verify existing databases work
- [ ] Test with existing projects
- [ ] Verify no data loss

### 5. Documentation Testing
- [ ] Update README with mode selection
- [ ] Update CHANGELOG
- [ ] Verify all examples work
- [ ] API documentation complete

### 6. Build & Release Testing
- [ ] Clean build passes
- [ ] All tests pass
- [ ] Package publishes correctly
- [ ] Installation works via npm
- [ ] Claude Desktop config works

## Performance Monitoring Process

### For Every PR:
1. Performance tests run automatically
2. Results compared against baseline
3. Report posted as PR comment
4. Critical regressions block merge

### For Main Branch:
1. Baseline updated on merge
2. Trend reports generated
3. Performance artifacts retained

## Next Steps
1. Fix remaining TypeScript build errors
2. Run full test suite
3. Test with Claude Desktop
4. Document performance requirements
5. Prepare for v0.3.0 release

## Test Commands
```bash
# Run performance tests
npm run test:performance

# Update baseline
npm run perf:baseline

# Compare against baseline
npm run perf:compare performance-results/performance-*.json

# Full test suite
npm run test:all
```
