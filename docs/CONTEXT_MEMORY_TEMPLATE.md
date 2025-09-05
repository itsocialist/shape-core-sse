# MCP Context Memory - Project Context Recording Template

## Purpose
This template helps you properly record project context using the MCP Context Memory server. Use it at the start of a project, during major milestones, and at the end of each work session.

## Quick Start Prompt
Copy and paste this at the beginning of a new Claude conversation:

```
I'm working on [PROJECT NAME]. Please use the MCP Context Memory to:
1. Create/update the project record
2. Store key decisions and context
3. Track what we accomplish this session
4. Document any issues or blockers
5. Save clear next steps before we end

Let's start by setting up the project context.
```

## Detailed Recording Templates

### 1. Project Setup (Use Once)
```
Please store this project context:

Project Name: [unique-project-name]
Description: [What this project does and why it exists]
Repository: [GitHub/GitLab URL]
Local Directory: [/full/path/to/project]
Status: active
Tags: [language, framework, type, etc.]
Metadata: {
  "language": "typescript",
  "framework": "react",
  "database": "postgresql",
  "deployment": "vercel"
}
```

### 2. Session Start
```
Starting work session on [PROJECT NAME]. Please:
1. Show me the current project context
2. List recent updates
3. Show any todos from last session
4. Note that we're beginning work at [TIME]
```

### 3. Recording Decisions
```
Please record this architectural decision:
Type: decision
Key: [descriptive-key-name]
Value: We decided to [DECISION] because [REASONING]. 
Alternatives considered: [ALTERNATIVES].
Trade-offs: [TRADE-OFFS].
Tags: [architecture, backend, security, etc.]
```

### 4. Storing Code Patterns
```
Please store this code pattern for reuse:
Type: code
Key: [pattern-name]
Value: [CODE SNIPPET OR PATTERN DESCRIPTION]
Tags: [pattern-type, language, reusable]
Example usage: [HOW TO USE IT]
```

### 5. Tracking Issues
```
Please record this issue:
Type: issue  
Key: [issue-identifier]
Value: Problem: [DESCRIPTION]. 
Error: [ERROR MESSAGE].
Attempted solutions: [WHAT WE TRIED].
Status: [open/investigating/blocked]
Tags: [bug, performance, security, etc.]
```

### 6. Session Progress Updates
```
Please update the project status:
Type: status
Key: session-[DATE]-progress
Value: Completed: [WHAT WAS DONE].
In Progress: [WHAT'S BEING WORKED ON].
Blocked: [ANY BLOCKERS].
Time spent: [HOURS].
Tags: [progress, session, DATE]
```

### 7. Recording TODOs
```
Please store these next steps:
Type: todo
Key: next-session-tasks
Value: Priority tasks:
1. [HIGH PRIORITY TASK]
2. [MEDIUM PRIORITY TASK]  
3. [LOW PRIORITY TASK]
Estimated time: [HOURS]
Dependencies: [WHAT'S NEEDED]
Tags: [priority, next-session]
```

### 8. System-Specific Information
```
Please store this system-specific config:
Type: config
Key: [config-name]
Value: [CONFIGURATION DETAILS]
System Specific: true
Tags: [environment, config, system]
Note: This is specific to my [MACHINE NAME]
```

### 9. Session End
```
Let's wrap up this session. Please:
1. Update project status with what we accomplished
2. Store any important code snippets we created
3. Document any unresolved issues
4. Create clear next steps
5. Show me a summary of what was stored
6. Note session end time: [TIME]
```

## Search Examples

### Finding Information
```
# Find all decisions for a project
Search for all decisions in [PROJECT NAME]

# Find recent work
What was updated in [PROJECT NAME] in the last week?

# Find by tag
Show me all security-related contexts

# Find specific content
Search for contexts containing "[SEARCH TERM]"

# Get full project context
Show me everything about [PROJECT NAME]
```

## Best Practices

### ✅ DO:
- Use descriptive, searchable keys (e.g., "auth-jwt-implementation" not "auth1")
- Tag consistently (create a tag taxonomy for your team)
- Update status at major milestones
- Store "why" not just "what" in decisions
- Include error messages and stack traces in issues
- Set items as system-specific when they contain local paths

### ❌ DON'T:
- Store sensitive credentials (use environment variables)
- Create duplicate keys (they overwrite)
- Use spaces in project names (use-hyphens)
- Forget to tag entries (makes searching harder)
- Store huge code files (store patterns and snippets)

## Context Types Reference

- **decision**: Architectural/design decisions with reasoning
- **code**: Reusable code snippets and patterns
- **standard**: Coding standards and conventions
- **status**: Current state and progress updates  
- **todo**: Tasks and next steps
- **note**: General observations and notes
- **config**: Configuration and setup information
- **issue**: Bugs, problems, and blockers
- **reference**: External links and documentation

## Multi-Session Workflow

### Starting Fresh
```
I'm starting a new session on [PROJECT]. Please show me:
1. Project details
2. Recent updates  
3. Any todos
4. Current status
```

### Continuing Work
```
I'm continuing work on [PROJECT] from [LAST SESSION REFERENCE].
Please show me where we left off and what needs to be done.
```

### Handoff to Another Developer
```
Please create a handoff summary for [PROJECT] including:
1. Project overview
2. Current status
3. Recent decisions
4. Known issues
5. Next steps
6. System-specific configs they'll need
```

## Advanced Usage

### Cross-Project Standards
```
Store this as a shared coding standard (no project name):
Type: standard
Key: [standard-name]
Value: [STANDARD DESCRIPTION]
Tags: [coding-standard, all-projects]
```

### Time-Based Queries
```
Show me all updates from:
- Today: since "-1 day"
- This week: since "-7 days"  
- This month: since "-30 days"
```

### Batch Operations
```
For [PROJECT NAME], please:
1. Update status to 'paused'
2. Add note about why it's paused
3. Create todo for resuming
4. Show updated project info
```

## Example: Complete Session

```
Human: I'm working on my-awesome-api. Please use the MCP Context Memory to track our work.