# CI/CD Setup for MPCM-Pro Adapter Swappability

## Overview
We use a hybrid CI/CD approach:
- **GitHub Actions**: Type checking, unit tests, security checks
- **Local Jenkins**: Real MCP server integration tests

## GitHub Actions Setup

### Automatic
GitHub Actions are already configured in `.github/workflows/adapter-ci.yml`. They will run automatically on:
- Push to `main` or `feature/adapter-swappability` branches
- Pull requests to `main`

### What it tests:
- TypeScript compilation
- Type checking
- Linting
- Unit tests
- Security audit
- Build artifacts

## Jenkins Setup (Local)

### Quick Start (if Jenkins is already installed)
```bash
# Check if Jenkins is running
curl http://localhost:8080

# Start Jenkins if needed
brew services start jenkins-lts

# View Jenkins
open http://localhost:8080
```

### First Time Setup
```bash
# Run the setup script
./scripts/setup-jenkins.sh

# This will:
# 1. Check if Jenkins is installed
# 2. Configure Jenkins for MPCM-Pro
# 3. Create job configuration
# 4. Show admin password
```

### Creating the Pipeline Job
1. Open Jenkins: http://localhost:8080
2. Click "New Item"
3. Name: `mpcm-pro-adapter-pipeline`
4. Type: Pipeline
5. Pipeline definition: Pipeline script from SCM
6. SCM: Git
7. Repository URL: `file:///Users/briandawson/Development/mpcm-pro`
8. Branch: `*/feature/adapter-swappability`
9. Script Path: `Jenkinsfile.adapter-swappability`

### Required Jenkins Plugins
- Pipeline
- Git
- NodeJS (configure as "Node 18" in Tools)

## Triggering Builds

### Manual (Web UI)
1. Go to http://localhost:8080/job/mpcm-pro-adapter-pipeline
2. Click "Build Now"

### Command Line
```bash
# Using our trigger script (recommended)
./scripts/trigger-jenkins-build.sh

# Check status
./scripts/trigger-jenkins-build.sh status

# Using jenkins-cli directly
jenkins-cli build mpcm-pro-adapter-pipeline -s http://localhost:8080
```

### Automatic
Jenkins polls the repository every 15 minutes for changes on the feature branch.

## What Jenkins Tests
1. **Type checking and linting** (parallel)
2. **Unit tests** for adapter pattern
3. **Real MCP server tests** (when on feature branch)
   - Actual Cyanheads Git MCP server
   - Mock server for comparison
4. **Compatibility tests** (backward compatibility)
5. **Performance benchmarks**
6. **Build verification**

## Troubleshooting

### Jenkins not starting
```bash
# Check status
brew services list | grep jenkins

# View logs
brew services log jenkins-lts

# Restart
brew services restart jenkins-lts
```

### Build failures
1. Check Jenkins console output
2. Ensure MCP servers are installed:
   ```bash
   npm install -g @cyanheads/git-mcp-server
   ```
3. Check test workspace permissions

### Permission issues
If Jenkins can't access the repository:
```bash
# Ensure Jenkins can read the project
chmod -R 755 /Users/briandawson/Development/mpcm-pro
```

## Development Workflow

1. Create feature branch
2. Write tests first (TDD)
3. Push to trigger GitHub Actions
4. Run local Jenkins for integration tests
5. Fix any issues
6. Create PR when both CI systems pass

## Pipeline Status Badges
Once everything is set up, you can add status badges to the main README:
```markdown
![GitHub Actions](https://github.com/briandawson/mpcm-pro/workflows/Adapter%20CI/badge.svg)
![Jenkins](http://localhost:8080/job/mpcm-pro-adapter-pipeline/badge/icon)
```

## Next Steps
1. Verify Jenkins is running
2. Create the pipeline job
3. Run a test build
4. Start implementing adapter swappability!
