pipeline {
    agent any

    environment {
        OCI_HOST = 'ubuntu@80.225.207.232'
        DEPLOY_DIR = '/home/ubuntu/dbnodesfs'
        REPO_URL = 'https://github.com/Nithin0620/DBNodesFS.git'
    }

    stages {
        stage('Deploy Backend to OCI') {
            steps {
                sshagent(['oci-ssh-key']) {
                    sh '''
                        ssh -o StrictHostKeyChecking=no ${OCI_HOST} "
                            set -e
                            if [ ! -d ${DEPLOY_DIR} ]; then
                                git clone ${REPO_URL} ${DEPLOY_DIR}
                            fi
                            cd ${DEPLOY_DIR}
                            git fetch --all
                            git reset --hard origin/main
                            docker compose up -d --build --scale web=0 --remove-orphans
                        "
                    '''
                }
            }
        }
    }

    post {
        failure {
            echo "❌ Backend deployment to OCI failed. Check logs above."
        }
        success {
            echo "✅ Successfully deployed backend cluster to OCI! (Cloudflare Pages auto-deploys frontend independently)."
        }
    }
}
