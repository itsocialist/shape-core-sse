# Role Templates

This directory contains example role templates that you can import into your MCP Context Memory server. These templates demonstrate best practices for creating custom roles that extend the default five roles.

## Available Templates

### 🔒 Security Engineer
- **Base Role**: Software Architect
- **Focus**: Security architecture, threat modeling, vulnerability assessment
- **Use Case**: Security-focused development, compliance requirements

### 📝 Technical Writer
- **Base Role**: Developer
- **Focus**: Documentation, tutorials, API docs, user guides
- **Use Case**: Creating and maintaining project documentation

### 📊 Data Engineer
- **Base Role**: Developer
- **Focus**: Data pipelines, ETL processes, data infrastructure
- **Use Case**: Building and maintaining data systems

### 🔧 Platform Engineer
- **Base Role**: DevOps Engineer
- **Focus**: Developer platforms, tooling, automation
- **Use Case**: Building internal developer tools and platforms

### 🎨 Frontend Engineer
- **Base Role**: Developer
- **Focus**: UI/UX, accessibility, client-side development
- **Use Case**: Frontend specialization with UI/UX focus

### 🤖 Machine Learning Engineer
- **Base Role**: Developer
- **Focus**: ML models, training, deployment, MLOps
- **Use Case**: AI/ML system development and deployment

## How to Use These Templates

Templates are imported directly in your Claude conversation. There's no separate installation process.

### Method 1: Import via MCP Tool
```bash
# In Claude, copy the template content and say:
"Import this role template: <paste the JSON content from any template file>"

# Or be more specific:
"Import the security engineer role template"
# Then paste the content when Claude asks
```

### Method 2: Import with Custom ID
```bash
# Override the template's ID during import
"Import this template but call it 'my-security-role' instead"
# Then paste the template JSON
```

### Method 3: Create Based on Template
```bash
# Ask Claude to create a role based on a template
"Create a custom role like the security engineer template but focused more on cloud security"
```

## Creating Your Own Templates

A role template should include:

```json
{
  "id": "unique-role-id",              // Alphanumeric with dashes/underscores
  "name": "Display Name",              // Human-readable name
  "description": "Role description",    // Clear description of role's purpose
  "base_role_id": "developer",         // Optional: inherit from existing role
  "focus_areas": [                     // Areas this role concentrates on
    "area1",
    "area2"
  ],
  "default_tags": ["tag1", "tag2"],   // Tags auto-applied to contexts
  "preferred_context_types": [         // Types of context this role uses
    "decision",
    "code",
    "note"
  ]
}
```

## Best Practices

1. **Choose the Right Base Role**: Inherit from the role that most closely matches your needs
2. **Be Specific with Focus Areas**: Use 5-10 specific terms that describe the role's work
3. **Use Meaningful Tags**: Tags should help with searching and organization
4. **Select Appropriate Context Types**: Choose 3-5 types that the role uses most

## Sharing Templates

Feel free to contribute your own role templates via pull request! Templates should be:
- Well-documented
- Generally applicable
- Follow the existing format
- Include realistic focus areas and tags
