# MCP Context Memory - Comprehensive Test Plan

## ✅ Completed Tests
1. **Basic CRUD Operations** - All working
2. **Cross-Session Persistence** - Verified working
3. **Search Functionality** - Fixed hyphen bug, basic search working
4. **SQL Injection** - Properly protected
5. **Unicode Support** - Full support for emojis and international characters

## 🔄 Tests to Run

### 1. Performance & Scale Tests
- [ ] **Stress Test** - Run `node stress-test.js` to test with 100+ entries
- [ ] **Concurrent Access** - Run `node concurrent-test.js` to test SQLite locking
- [ ] **Large Metadata** - Test storing very large JSON objects
- [ ] **Memory Usage** - Monitor memory with large datasets

### 2. Edge Cases
- [ ] **Circular References** - Test metadata with circular JSON
- [ ] **Binary Data** - Test base64 encoded content
- [ ] **Network Paths** - Test with network file paths
- [ ] **Permission Errors** - Test with read-only database

### 3. Data Integrity Tests
- [ ] **Backup/Restore** - Manual backup and restore of database
- [ ] **Migration Rollback** - Test rollback functionality
- [ ] **Data Corruption** - Simulate and recover from corruption
- [ ] **Transaction Rollback** - Test failed transactions

### 4. Security Tests
- [ ] **Path Traversal** - Already tested, verify with ../../../etc/passwd
- [ ] **Command Injection** - Test with $(rm -rf /) in values
- [ ] **XXE Injection** - Test with XML entities in JSON
- [ ] **Resource Exhaustion** - Test with infinite loops in metadata

### 5. Integration Tests
- [ ] **Multiple Projects** - Test with 10+ active projects
- [ ] **Project Switching** - Rapid context switching
- [ ] **System Detection** - Test on different machines
- [ ] **Time Zone Handling** - Test with different TZ settings

### 6. Error Recovery Tests
- [ ] **Database Lock** - Test recovery from locked database
- [ ] **Disk Full** - Test behavior when disk is full
- [ ] **Missing Database** - Test auto-recreation
- [ ] **Corrupted Index** - Test FTS5 index recovery

### 7. API Contract Tests
- [ ] **Required Fields** - Test all required field validations
- [ ] **Type Validation** - Test wrong types for each field
- [ ] **Enum Validation** - Test invalid enum values
- [ ] **Size Limits** - Test all size limit validations

## 🐛 Known Issues to Test
1. **Tag Search** - JSON path error needs investigation
2. **Full-text Search** - Special characters need more testing
3. **Module Version** - Node.js version compatibility
4. **Performance** - No connection pooling yet

## 📊 Test Metrics to Track
- Response time for 1, 10, 100, 1000 entries
- Memory usage growth rate
- Database file size growth
- Search performance degradation
- Concurrent access success rate
