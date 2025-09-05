# Test Prompt Instructions

These test files are designed to validate the MCP Context Memory server functionality at different levels. 

## How to Use

1. **Start a fresh Claude Desktop conversation** for each test file
2. **Copy prompts one at a time** and observe Claude's behavior
3. **Wait for Claude's response** before entering the next prompt
4. **Document results** in the test-results directory

## Test Levels

1. **01-basic-tool-tests.txt** - Direct tool validation
   - Purpose: Verify all tools are accessible and functioning
   - Expected: Each command should execute successfully

2. **02-role-workflow-tests.txt** - Natural language role transitions
   - Purpose: Test Claude's understanding of role-based workflows
   - Expected: Claude should recognize role contexts and suggest transitions

3. **03-ambiguous-request-tests.txt** - Vague request handling
   - Purpose: Test Claude's ability to interpret unclear requests
   - Expected: Claude should ask clarifying questions or make reasonable assumptions

4. **04-context-interpretation-tests.txt** - Information categorization
   - Purpose: Test how Claude categorizes different types of information
   - Expected: Claude should store contexts with appropriate types and tags

5. **05-error-handling-tests.txt** - Error and edge cases
   - Purpose: Ensure graceful error handling
   - Expected: Claude should provide helpful error messages, not crash

6. **06-complex-workflow-tests.txt** - Multi-step scenarios
   - Purpose: Test complex, real-world workflows
   - Expected: Claude should maintain context across multiple related requests

## Recording Results

Create a file in test-results/ with the format:
- test-results/YYYY-MM-DD-test-name-v{version}.md
- Include: success rate, notable issues, Claude's interpretations

## Regression Testing

Run these same tests after any significant changes to ensure backward compatibility.
