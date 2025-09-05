# How to Import Jenkins Job from XML

## Method 1: Via Jenkins UI (Easiest)

1. **Open Jenkins**: http://localhost:8080

2. **Create New Item**:
   - Click "New Item" on the left menu
   - Enter name: `mpcm-pro-adapter-pipeline`
   - Select "Pipeline"
   - Click "OK"

3. **In the Configure Page**:
   - Scroll down to the "Pipeline" section
   - Definition: "Pipeline script"
   - Copy and paste this script:

```groovy
pipeline {
    agent any
    
    environment {
        PROJECT_DIR = '/Users/briandawson/Development/mpcm-pro'
        PATH = "/usr/local/bin:${env.PATH}"
    }
    
    stages {
        stage('Setup') {
            steps {
                echo 'Setting up MPCM-Pro CI/CD Pipeline...'
                sh """
                    cd ${PROJECT_DIR}
                    echo 'Project directory: ${PROJECT_DIR}'
                    echo 'Node version:' 
                    node --version || echo 'Node not found'
                    echo 'NPM version:'
                    npm --version || echo 'NPM not found'
                """
            }
        }
        
        stage('Install') {
            steps {
                dir("${PROJECT_DIR}") {
                    sh 'npm ci'
                }
            }
        }
        
        stage('Type Check') {
            steps {
                dir("${PROJECT_DIR}") {
                    script {
                        try {
                            sh 'npm run type-check'
                        } catch (Exception e) {
                            echo "Type check failed: ${e.message}"
                            currentBuild.result = 'UNSTABLE'
                        }
                    }
                }
            }
        }
        
        stage('Tests') {
            steps {
                dir("${PROJECT_DIR}") {
                    script {
                        try {
                            sh 'npm test -- --passWithNoTests'
                        } catch (Exception e) {
                            echo "Tests failed: ${e.message}"
                            currentBuild.result = 'UNSTABLE'
                        }
                    }
                }
            }
        }
        
        stage('Build') {
            steps {
                dir("${PROJECT_DIR}") {
                    script {
                        try {
                            sh 'npm run build'
                        } catch (Exception e) {
                            echo "Build failed: ${e.message}"
                            currentBuild.result = 'UNSTABLE'
                        }
                    }
                }
            }
        }
    }
    
    post {
        success {
            echo '✅ Pipeline completed successfully!'
        }
        unstable {
            echo '⚠️ Pipeline completed with warnings'
        }
        failure {
            echo '❌ Pipeline failed'
        }
    }
}
```

4. **Optional Settings**:
   - Build Triggers → Poll SCM: `H/15 * * * *`
   - Check "Do not allow concurrent builds"

5. **Save** the job

## Method 2: Using curl to Create Job

If you prefer command line:

```bash
# First, let's create a fixed XML without special characters
cd /Users/briandawson/Development/mpcm-pro

# Create the job using curl
curl -X POST "http://localhost:8080/createItem?name=mpcm-pro-adapter-pipeline" \
  -H "Content-Type: application/xml" \
  --data-binary @jenkins-job-config-fixed.xml
```

## Method 3: Copy from Existing Job

If you already have a pipeline job:

1. Go to Jenkins Dashboard
2. Click on any existing Pipeline job
3. Click "Configure"
4. At the bottom, click "Copy from"
5. Modify the pipeline script as needed

## After Creating the Job

1. Click on the job name: `mpcm-pro-adapter-pipeline`
2. Click "Build Now" to test
3. Click on the build number (#1)
4. Click "Console Output" to see what's happening

## Troubleshooting

If the build fails:

1. **Permission issues**: Make sure Jenkins can access your project
   ```bash
   ls -la /Users/briandawson/Development/mpcm-pro
   ```

2. **Node/NPM not found**: Add to PATH in pipeline:
   ```groovy
   environment {
       PATH = "/usr/local/bin:/opt/homebrew/bin:${env.PATH}"
   }
   ```

3. **NPM install fails**: Check if node_modules needs cleaning:
   ```bash
   cd /Users/briandawson/Development/mpcm-pro
   rm -rf node_modules
   npm install
   ```
