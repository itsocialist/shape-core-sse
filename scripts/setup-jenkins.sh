#!/bin/bash

# Jenkins Setup Script for MPCM-Pro
# Created: June 25, 2025
# Purpose: Install and configure Jenkins for local MCP integration testing

set -e  # Exit on error

echo "🚀 MPCM-Pro Jenkins Setup Script"
echo "================================"

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew not found. Please install Homebrew first:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    exit 1
fi

# Check if jenkins-cli is available
if ! command -v jenkins-cli &> /dev/null; then
    echo "❌ jenkins-cli not found but Jenkins might be installed"
    echo "   This is okay - we'll check Jenkins status next"
fi

# Function to check if Jenkins is already installed
check_jenkins() {
    if brew list jenkins-lts &> /dev/null; then
        echo "✅ Jenkins is already installed"
        return 0
    else
        return 1
    fi
}

# Function to install Jenkins
install_jenkins() {
    echo "📦 Installing Jenkins LTS..."
    brew install jenkins-lts
    
    echo "📦 Installing Jenkins CLI..."
    brew install jenkins-cli
}

# Function to configure Jenkins
configure_jenkins() {
    echo "⚙️  Configuring Jenkins..."
    
    # Create Jenkins home directory if it doesn't exist
    JENKINS_HOME="$HOME/.jenkins"
    mkdir -p "$JENKINS_HOME"
    
    # Create basic configuration
    cat > "$JENKINS_HOME/jenkins.yaml" <<EOF
jenkins:
  systemMessage: "MPCM-Pro CI/CD Server"
  numExecutors: 2
  mode: NORMAL
  
  globalNodeProperties:
  - envVars:
      env:
      - key: "PROJECT_DIR"
        value: "/Users/briandawson/Development/mpcm-pro"
      - key: "NODE_VERSION"
        value: "18"

unclassified:
  location:
    url: "http://localhost:8080/"
EOF
}

# Function to start Jenkins
start_jenkins() {
    echo "🏁 Starting Jenkins..."
    brew services start jenkins-lts
    
    echo "⏳ Waiting for Jenkins to start (this may take a minute)..."
    sleep 30
    
    # Check if Jenkins is running
    if curl -s http://localhost:8080 > /dev/null; then
        echo "✅ Jenkins is running at http://localhost:8080"
    else
        echo "❌ Jenkins failed to start. Check logs with: brew services log jenkins-lts"
        exit 1
    fi
}

# Function to get initial admin password
get_admin_password() {
    echo ""
    echo "🔑 Jenkins Initial Admin Password:"
    echo "=================================="
    
    JENKINS_HOME="$HOME/.jenkins"
    if [ -f "$JENKINS_HOME/secrets/initialAdminPassword" ]; then
        cat "$JENKINS_HOME/secrets/initialAdminPassword"
    else
        echo "Password file not found. Jenkins might still be initializing."
        echo "Try: cat ~/.jenkins/secrets/initialAdminPassword"
    fi
    echo ""
}

# Function to create pipeline job
create_pipeline_job() {
    echo "📝 Creating Jenkins pipeline job..."
    
    # Create job configuration
    cat > /tmp/mpcm-pro-job.xml <<EOF
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>MPCM-Pro Adapter Swappability CI/CD Pipeline</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
      <triggers>
        <hudson.triggers.SCMTrigger>
          <spec>H/15 * * * *</spec>
        </hudson.triggers.SCMTrigger>
      </triggers>
    </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition">
    <scm class="hudson.plugins.git.GitSCM">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>file:///Users/briandawson/Development/mpcm-pro</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/feature/adapter-swappability</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
    </scm>
    <scriptPath>Jenkinsfile.adapter-swappability</scriptPath>
  </definition>
</flow-definition>
EOF

    echo "Job configuration created. You'll need to import this manually after initial setup."
    echo "Location: /tmp/mpcm-pro-job.xml"
}

# Main execution
echo ""
echo "🔍 Checking current setup..."

if check_jenkins; then
    echo "Jenkins is already installed."
    echo ""
    echo "To start Jenkins: brew services start jenkins-lts"
    echo "To stop Jenkins:  brew services stop jenkins-lts"
    echo "To restart:       brew services restart jenkins-lts"
    echo "View logs:        brew services log jenkins-lts"
else
    echo "Jenkins not found. Installing..."
    install_jenkins
    configure_jenkins
    start_jenkins
fi

# Always try to get admin password
get_admin_password

# Create job configuration
create_pipeline_job

echo ""
echo "📋 Next Steps:"
echo "============="
echo "1. Open http://localhost:8080 in your browser"
echo "2. Use the admin password shown above to unlock Jenkins"
echo "3. Install suggested plugins (or select specific ones)"
echo "4. Create your admin user"
echo "5. Install these additional plugins:"
echo "   - Pipeline"
echo "   - Git"
echo "   - NodeJS"
echo "6. Configure NodeJS installation:"
echo "   - Go to Manage Jenkins → Tools"
echo "   - Add NodeJS installation named 'Node 18'"
echo "7. Create new Pipeline job:"
echo "   - Name: 'mpcm-pro-adapter-pipeline'"
echo "   - Type: Pipeline"
echo "   - Pipeline from SCM → Git"
echo "   - Repository: file:///Users/briandawson/Development/mpcm-pro"
echo "   - Script Path: Jenkinsfile.adapter-swappability"
echo ""
echo "🎯 Once setup is complete, you can trigger builds manually or wait for polling."
