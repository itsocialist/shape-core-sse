#!/bin/bash
# Script to create Jenkins job via API with CSRF token

JENKINS_URL="http://localhost:8080"
JOB_NAME="mpcm-pro-adapter-pipeline"

# Get the crumb (CSRF token)
echo "Getting Jenkins crumb..."
CRUMB=$(curl -s "${JENKINS_URL}/crumbIssuer/api/xml?xpath=concat(//crumbRequestField,\":\",//crumb)")

if [ -z "$CRUMB" ]; then
    echo "Could not get crumb. You may need to:"
    echo "1. Log into Jenkins first"
    echo "2. Or disable CSRF protection (not recommended)"
    echo "3. Or use the Script Console method instead"
    exit 1
fi

echo "Got crumb: $CRUMB"

# Create simple job XML
cat > /tmp/jenkins-job.xml << 'EOF'
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>MPCM-Pro Adapter Pipeline</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition">
    <script>pipeline {
    agent any
    environment {
        PROJECT_DIR = '/Users/briandawson/Development/mpcm-pro'
    }
    stages {
        stage('Build') {
            steps {
                sh 'echo "Building MPCM-Pro..."'
                sh 'cd ${PROJECT_DIR} &amp;&amp; npm run build || true'
            }
        }
    }
}</script>
    <sandbox>true</sandbox>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
EOF

# Create the job
echo "Creating job..."
curl -X POST "${JENKINS_URL}/createItem?name=${JOB_NAME}" \
  -H "$CRUMB" \
  -H "Content-Type: application/xml" \
  --data-binary @/tmp/jenkins-job.xml

echo ""
echo "Job creation attempted. Check ${JENKINS_URL}/job/${JOB_NAME}/"
