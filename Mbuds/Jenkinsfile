pipeline{
agent any
environment{
APP_NAME='moodbuds'
DOCKERFILE='Dockerfile'
IMAGE_TAG="${BUILD_NUMBER}"
DOCKER_HOST='tcp://elated_robinson:2375'//DOCKER IN DOCKER NETWORK
DOCKER_CERT_PATH=''
DOCKER_TLS_VERIFY=''
}
stages{
stage('checkout'){
    steps{
    echo 'Taking a poll'
    checkout scm
    }
}
stage('verify-environment'){
steps{
sh '''
node --version
npm --version
docker --info
docker info
'''
  }
}
stage('Install Dependencies'){
  steps{
    sh 'npm ci'
  }
}
stage('Run Tests'){
    steps{
    echo 'We  performing the testing now '
    '''
    ping -c 1 http://localhost:8089/
    '''
    }
}

stage('Build Docker Image'){
    steps{
    sh 'docker build -f "$DOCKERFILE" -t "moodbuds:$IMAGE_TAG" -t "moodbuds:$GIT_COMMIT" .'
    }
 }
}
post{
    success{
   echo "CI built.Built ${APP_NAME}:${IMAGE_TAG}"
    }
    failure{
    
    echo "Pipeline failed. Check the failed stage logs"
    }
    always{
     echo "The Build for ${BUILD_NUMBER} has completed"
    }
 
    }

}