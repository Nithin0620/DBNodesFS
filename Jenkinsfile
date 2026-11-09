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
                withCredentials([sshUserPrivateKey(credentialsId: 'oci-ssh-key', keyFileVariable: 'SSH_KEY')]) {
                    sh '''
                        ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ${OCI_HOST} "
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
        success {
            echo "✅ Jenkins Pipeline succeeded! Backend cluster deployed to OCI."
        }
        failure {
            echo "❌ Jenkins Pipeline failed."
        }
    }
}
