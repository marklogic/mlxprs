@Library('shared-libraries') _
pipeline{
  agent {label 'devExpLinuxPool'}
  environment{
    JAVA_HOME_DIR="/home/builder/java/openjdk-1.8.0-262"
    NODE_HOME_DIR="/home/builder/nodeJs/node-v16.19.1-linux-x64"
    GRADLE_DIR   =".gradle"
    DMC_USER     = credentials('MLBUILD_USER')
    DMC_PASSWORD = credentials('MLBUILD_PASSWORD')
  }
  options {
    checkoutToSubdirectory 'mlxprs'
    buildDiscarder logRotator(artifactDaysToKeepStr: '7', artifactNumToKeepStr: '', daysToKeepStr: '30', numToKeepStr: '')
  }
  stages{
    stage('tests'){
      steps{
        copyRPM 'Release','11.0.3'
        setUpML '$WORKSPACE/xdmp/src/Mark*.rpm'
        sh label:'runtests', script: '''#!/bin/bash
          export JAVA_HOME=$JAVA_HOME_DIR
          export NODE_HOME=$NODE_HOME_DIR
          export GRADLE_USER_HOME=$WORKSPACE/$GRADLE_DIR
          export PATH=$JAVA_HOME/bin:$NODE_HOME/bin:$GRADLE_USER_HOME:$PATH
          cd $WORKSPACE/mlxprs/test-app
          ./gradlew -i mlDeploy
          cd $WORKSPACE/mlxprs/
          npm run installAll
          npm run test
        '''
        junit '**/target/surefire-reports/**/*.xml'
      }
    }
  }
}
