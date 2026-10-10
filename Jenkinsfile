// CI/CD แบบพื้นฐาน: Checkout -> Build -> Test -> Deploy
//
// สิ่งที่ต้องมีบน Jenkins: docker CLI + docker compose plugin และสิทธิ์ใช้ /var/run/docker.sock
// Credential (Manage Jenkins > Credentials):
//   - crud-prod-env : Secret file = ไฟล์ .env ของ production (ดู .env.example)

pipeline {
  // รันบน agent (เครื่อง/node) ตัวไหนก็ได้ที่ว่าง — ถ้ามี Jenkins เครื่องเดียวก็คือตัว Jenkins เอง
  agent any

  options {
    // ห้ามรัน job นี้ซ้อนกัน ถ้ามี build ใหม่เข้ามาระหว่างที่อันเก่ายังรันอยู่ จะต่อคิวรอ
    disableConcurrentBuilds()
    // ถ้า build นานเกิน 30 นาที ให้ยกเลิกอัตโนมัติ (กันค้าง)
    timeout(time: 30, unit: 'MINUTES')
  }

  // ตัวแปร environment ที่ใช้ได้ทุก stage
  environment {
    // docker compose จะอ่านตัวแปรนี้เองอัตโนมัติ -> ไม่ต้องพิมพ์ -f docker-compose.prod.yml ทุกคำสั่ง
    COMPOSE_FILE = 'docker-compose.prod.yml'
    // ชื่อ project ของชุดทดสอบ เช่น crud-test-15 (15 = เลข build)
    // ตั้งชื่อไม่ซ้ำกับ production (crud-prod) เพื่อให้ container/volume แยกกันเด็ดขาด
    TEST_PROJECT = "crud-test-${env.BUILD_NUMBER}"
  }

  stages {
    // ---------------------------------------------------------------
    // 1) ดึงโค้ดจาก Git repo ที่ตั้งไว้ใน job (Pipeline script from SCM)
    // ---------------------------------------------------------------
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // ---------------------------------------------------------------
    // 2) Build docker image ทุก service (db, backend, frontend) ตาม docker-compose.prod.yml
    //    ถ้าโค้ดมี error ตอน build (เช่น npm install / vite build พัง) pipeline จะหยุดตรงนี้
    // ---------------------------------------------------------------
    stage('Build') {
      steps {
        sh 'docker compose -p $TEST_PROJECT build'
      }
    }

    // ---------------------------------------------------------------
    // 3) ยกทั้งระบบขึ้นมาชั่วคราวแล้วลองเรียกใช้งานจริง (smoke test)
    // ---------------------------------------------------------------
    stage('Test') {
      // ค่าที่ docker-compose.prod.yml ต้องใช้ (${DB_NAME} ฯลฯ) — ใช้เฉพาะตอนทดสอบเท่านั้น
      environment {
        MYSQL_ROOT_PASSWORD = 'test_root'
        DB_NAME = 'crud_db'
        DB_USER = 'test'
        DB_PASSWORD = 'test'
        APP_PORT = '0' // ให้ docker สุ่ม port จะได้ไม่ชนกับ production
      }
      steps {
        sh '''
          # สตาร์ททุก container แบบ background (-d)
          # --wait = รอจนทุก container อยู่สถานะ running/healthy ก่อนไปบรรทัดถัดไป
          docker compose -p $TEST_PROJECT up -d --wait

          # รอ backend พร้อม (เรียกผ่าน nginx ใน container frontend)
          # วนลองสูงสุด 30 ครั้ง ครั้งละ 2 วินาที (รวม ~1 นาที)
          for i in $(seq 1 30); do
            # exec -T = รันคำสั่งใน container frontend (-T คือไม่ต้องใช้ terminal เพราะ Jenkins ไม่มี)
            # wget -qO- = ยิง HTTP แล้วพิมพ์ผลลัพธ์ออกจอ, ใช้ 127.0.0.1 เพราะ localhost ใน alpine ชี้ไป IPv6
            if docker compose -p $TEST_PROJECT exec -T frontend wget -qO- http://127.0.0.1/api/health; then
              break   # ตอบกลับสำเร็จ -> ออกจาก loop
            fi
            # ครบ 30 ครั้งแล้วยังไม่ตอบ -> exit 1 ทำให้ stage นี้ fail
            [ "$i" = 30 ] && { echo "API ไม่ตอบ"; exit 1; }
            sleep 2
          done
          echo

          # ทดสอบว่า backend ต่อ MySQL ได้และดึงข้อมูลได้
          # (ถ้า HTTP error, wget จะคืนค่า != 0 และ sh ของ Jenkins จะ fail ทันที)
          echo "--- GET /api/items ---"
          docker compose -p $TEST_PROJECT exec -T frontend wget -qO- http://127.0.0.1/api/items
          echo

          # ทดสอบว่าหน้าเว็บ React ถูก build และ nginx เสิร์ฟได้
          # grep -q หา <div id="root"> ใน HTML ถ้าไม่เจอ -> fail
          echo "--- GET / ---"
          docker compose -p $TEST_PROJECT exec -T frontend wget -qO- http://127.0.0.1/ | grep -q '<div id="root">'
        '''
      }
      // post = สิ่งที่ทำหลัง stage นี้จบ
      post {
        // ถ้าเทสไม่ผ่าน: พิมพ์ log 100 บรรทัดล่าสุดของทุก container ไว้ดูสาเหตุ
        failure {
          sh 'docker compose -p $TEST_PROJECT logs --no-color --tail=100 || true'
        }
        // ไม่ว่าผ่านหรือไม่ผ่าน: ลบ container + volume (-v) ของชุดทดสอบทิ้ง
        // || true = ถ้าคำสั่งลบ error ก็ไม่ต้องทำให้ build fail
        always {
          sh 'docker compose -p $TEST_PROJECT down -v --remove-orphans || true'
        }
      }
    }

    // ---------------------------------------------------------------
    // 4) Deploy ขึ้น production (มาถึงตรงนี้ได้แปลว่า Build + Test ผ่านแล้ว)
    // ---------------------------------------------------------------
    stage('Deploy') {
      // deploy เฉพาะ branch main เท่านั้น
      //   BRANCH_NAME = ใช้กับ job แบบ Multibranch Pipeline
      //   GIT_BRANCH  = ใช้กับ job แบบ Pipeline ธรรมดา (ค่าจะเป็น origin/main)
      when {
        expression { env.BRANCH_NAME == 'main' || env.GIT_BRANCH == 'origin/main' }
      }
      steps {
        // ดึงไฟล์ .env จาก Jenkins Credentials (id: crud-prod-env) มาเป็นไฟล์ชั่วคราว
        // path ของไฟล์อยู่ในตัวแปร PROD_ENV_FILE และไฟล์จะถูกลบเมื่อออกจาก block นี้
        withCredentials([file(credentialsId: 'crud-prod-env', variable: 'PROD_ENV_FILE')]) {
          sh '''
            # ไม่ใส่ -p -> ใช้ชื่อ project จากในไฟล์ compose คือ crud-prod
            # --build          = build image ใหม่จากโค้ดล่าสุด (layer ส่วนใหญ่ใช้ cache จาก stage Build)
            # -d --wait        = รันเบื้องหลังและรอจนทุก container พร้อม
            # --remove-orphans = ลบ container ของ service ที่ไม่มีในไฟล์ compose แล้ว
            # container เดิมจะถูกแทนที่ด้วยตัวใหม่ แต่ข้อมูล DB ใน volume ยังอยู่
            docker compose --env-file "$PROD_ENV_FILE" up -d --build --wait --remove-orphans

            # แสดงสถานะ container หลัง deploy ไว้ดูใน log
            docker compose --env-file "$PROD_ENV_FILE" ps
          '''
        }
      }
    }
  }

  // post ของทั้ง pipeline: ทำหลังทุก stage จบ
  post {
    always {
      // ลบ image เก่าที่ไม่มี tag แล้ว (dangling) ป้องกันดิสก์เต็มเมื่อ build บ่อย ๆ
      sh 'docker image prune -f || true'
    }
  }
}
