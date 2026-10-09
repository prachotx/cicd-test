// CI/CD pipeline: auto version -> build -> smoke test -> push -> tag -> deploy
//
// สิ่งที่ต้องมีบน Jenkins agent: git, docker, docker compose v2
// Credentials (ตั้งใน Jenkins > Manage Credentials):
//   - git-creds             : Username/Password (หรือ token) สำหรับ push git tag
//   - docker-registry-creds : Username/Password ของ registry (ใช้เมื่อกรอก REGISTRY)
//   - crud-prod-env         : Secret file = ไฟล์ .env ของ production (ดู .env.example)

def releaseBranch = 'main'

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
    timeout(time: 30, unit: 'MINUTES')
  }

  parameters {
    string(name: 'REGISTRY', defaultValue: '', description: 'เช่น docker.io/myuser หรือ registry.example.com/team (เว้นว่าง = ไม่ push image)')
    booleanParam(name: 'DEPLOY', defaultValue: true, description: 'deploy production หลัง build สำเร็จ (เฉพาะ branch main)')
  }

  environment {
    CI_PROJECT = "crud-ci-${env.BUILD_NUMBER}"
    COMPOSE_PROD = 'docker-compose.prod.yml'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
        // ต้องมี tag ทั้งหมดเพื่อคำนวณเวอร์ชัน
        sh 'git fetch --tags --force --prune'
      }
    }

    stage('Version') {
      steps {
        script {
          def branch = env.BRANCH_NAME ?: (env.GIT_BRANCH ?: '').replaceFirst(/^origin\//, '')
          env.IS_RELEASE = (branch == releaseBranch).toString()

          def next = sh(script: 'sh scripts/next-version.sh', returnStdout: true).trim()
          def tagExists = sh(script: "git rev-parse -q --verify refs/tags/v${next}", returnStatus: true) == 0
          env.NEW_RELEASE = (env.IS_RELEASE == 'true' && !tagExists).toString()

          if (env.IS_RELEASE == 'true') {
            env.APP_VERSION = next
          } else {
            // branch อื่น: pre-release version เช่น 1.3.0-feature-login.42
            def safeBranch = branch.replaceAll(/[^A-Za-z0-9.-]/, '-')
            env.APP_VERSION = "${next}-${safeBranch}.${env.BUILD_NUMBER}"
          }

          env.IMAGE_PREFIX = params.REGISTRY?.trim() ? "${params.REGISTRY.trim()}/" : ''
          currentBuild.displayName = "#${env.BUILD_NUMBER} v${env.APP_VERSION}"
          echo "Branch: ${branch} | Version: ${env.APP_VERSION} | New release: ${env.NEW_RELEASE}"
        }
      }
    }

    stage('Build images') {
      steps {
        sh 'docker compose -f $COMPOSE_PROD -p $CI_PROJECT build --pull'
      }
    }

    stage('Smoke test') {
      environment {
        MYSQL_ROOT_PASSWORD = 'ci_root'
        DB_NAME = 'crud_db'
        DB_USER = 'ci'
        DB_PASSWORD = 'ci'
        APP_PORT = '0' // ให้ docker สุ่ม port ไม่ชนกับ production
      }
      steps {
        sh '''
          docker compose -f $COMPOSE_PROD -p $CI_PROJECT up -d --no-build --wait

          for i in $(seq 1 30); do
            if docker compose -f $COMPOSE_PROD -p $CI_PROJECT exec -T frontend \
                 wget -qO- http://127.0.0.1/api/health | grep -q "\\"version\\":\\"$APP_VERSION\\""; then
              break
            fi
            [ "$i" = 30 ] && { echo "health check failed"; exit 1; }
            sleep 2
          done

          echo "--- GET /api/items ---"
          docker compose -f $COMPOSE_PROD -p $CI_PROJECT exec -T frontend wget -qO- http://127.0.0.1/api/items
          echo
          echo "--- GET / ---"
          docker compose -f $COMPOSE_PROD -p $CI_PROJECT exec -T frontend wget -qO- http://127.0.0.1/ | grep -q '<div id="root">'
        '''
      }
      post {
        failure {
          sh 'docker compose -f $COMPOSE_PROD -p $CI_PROJECT logs --no-color --tail=100 || true'
        }
        always {
          sh 'docker compose -f $COMPOSE_PROD -p $CI_PROJECT down -v --remove-orphans || true'
        }
      }
    }

    stage('Push images') {
      when {
        expression { params.REGISTRY?.trim() }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'docker-registry-creds', usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
          sh '''
            REG_HOST=$(echo "$IMAGE_PREFIX" | cut -d/ -f1)
            echo "$REG_PASS" | docker login "$REG_HOST" -u "$REG_USER" --password-stdin
            for svc in crud-backend crud-frontend; do
              docker push "${IMAGE_PREFIX}${svc}:${APP_VERSION}"
              if [ "$IS_RELEASE" = "true" ]; then
                docker tag "${IMAGE_PREFIX}${svc}:${APP_VERSION}" "${IMAGE_PREFIX}${svc}:latest"
                docker push "${IMAGE_PREFIX}${svc}:latest"
              fi
            done
          '''
        }
      }
      post {
        always {
          sh 'docker logout "$(echo "$IMAGE_PREFIX" | cut -d/ -f1)" || true'
        }
      }
    }

    stage('Tag release') {
      when {
        environment name: 'NEW_RELEASE', value: 'true'
      }
      steps {
        withCredentials([gitUsernamePassword(credentialsId: 'git-creds')]) {
          sh '''
            git -c user.name="Jenkins" -c user.email="jenkins@localhost" \
              tag -a "v$APP_VERSION" -m "Release v$APP_VERSION (build #$BUILD_NUMBER)"
            git push origin "v$APP_VERSION"
          '''
        }
      }
    }

    stage('Deploy production') {
      when {
        allOf {
          environment name: 'IS_RELEASE', value: 'true'
          expression { params.DEPLOY }
        }
      }
      steps {
        withCredentials([file(credentialsId: 'crud-prod-env', variable: 'PROD_ENV_FILE')]) {
          sh '''
            # ถ้ามี registry: ดึง image จาก registry, ถ้าไม่มี: ใช้ image ที่เพิ่ง build บนเครื่องนี้
            if [ -n "$IMAGE_PREFIX" ]; then
              docker compose -f $COMPOSE_PROD --env-file "$PROD_ENV_FILE" pull backend frontend
            fi
            docker compose -f $COMPOSE_PROD --env-file "$PROD_ENV_FILE" up -d --no-build --wait --remove-orphans
            docker compose -f $COMPOSE_PROD --env-file "$PROD_ENV_FILE" ps
          '''
        }
      }
    }
  }

  post {
    success {
      echo "✅ v${env.APP_VERSION} สำเร็จ"
    }
    failure {
      echo "❌ v${env.APP_VERSION} ล้มเหลว"
    }
    always {
      // ลบ image เก่าที่ไม่มี tag ป้องกันดิสก์เต็ม
      sh 'docker image prune -f || true'
    }
  }
}
