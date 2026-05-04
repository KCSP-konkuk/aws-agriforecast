# AgriForecast 서비스 구축 TODO 리스트

## 📋 개요
현재 프론트엔드(React + Vite)가 구현된 상태에서 실제 서비스를 위해 필요한 백엔드, 데이터베이스, API 연동 등의 작업을 순서대로 정리한 문서입니다.

---

## 1단계: 프로젝트 환경 설정 및 계획 수립

### 1.1 기술 스택 결정 ✅
- [x] **백엔드 프레임워크**: Java + Spring Boot
- [x] **데이터베이스**: MySQL
- [ ] **인증 방식 결정**
  - JWT (JSON Web Token) - 권장
  - Session 기반
  - OAuth 2.0 (선택사항)

### 1.2 개발 환경 설정 (상세 가이드)

#### 1.2.1 필수 소프트웨어 설치
- [ ] **Java JDK 설치**
  - 버전: JDK 21 
  - 설치 확인: `java -version`
  - 환경 변수 설정 (JAVA_HOME)
- [ ] **MySQL 설치**
  - 버전: MySQL 8.0 이상
  - 설치 확인: `mysql --version`
  - MySQL Workbench 설치 (선택사항, GUI 도구)
- [ ] **IDE 선택 및 설치**
  - IntelliJ IDEA (Community 또는 Ultimate) - 권장
  - Eclipse (STS)
  - VS Code + Java Extension Pack
- [ ] **Git 설치 및 설정**
  - Git 설치 확인: `git --version`
  - Git 사용자 정보 설정

#### 1.2.2 Spring Boot 프로젝트 생성
- [ ] **프로젝트 생성 방법 선택**
  
  **방법 1: Spring Initializr 사용 (권장)**
  1. https://start.spring.io 접속
  2. 프로젝트 설정:
     - Project: Maven 또는 Gradle (Gradle 권장)
     - Language: Java
     - Spring Boot: 3.x.x (최신 안정 버전)
     - Project Metadata:
       - Group: `com.agriforecast` (또는 팀 도메인)
       - Artifact: `backend` 또는 `agriforecast-api`
       - Name: `AgriForecast Backend`
       - Package name: `com.agriforecast.backend`
     - Packaging: Jar
     - Java: 17 또는 21
  3. Dependencies 추가:
     - Spring Web
     - Spring Data JPA
     - MySQL Driver
     - Spring Security
     - Lombok (선택사항, 코드 간소화)
     - Spring Boot DevTools (개발용)
  4. Generate 버튼 클릭하여 프로젝트 다운로드
  5. 압축 해제 후 IDE에서 열기

  **방법 2: IntelliJ IDEA에서 직접 생성**
  1. File → New → Project
  2. Spring Initializr 선택
  3. 위와 동일한 설정 입력
  4. Dependencies 선택
  5. Finish

- [ ] **프로젝트 디렉토리 구조 확인**
  ```
  backend/
  ├── src/
  │   ├── main/
  │   │   ├── java/
  │   │   │   └── com/agriforecast/backend/
  │   │   │       ├── BackendApplication.java
  │   │   │       ├── config/          # 설정 클래스
  │   │   │       ├── controller/      # REST 컨트롤러
  │   │   │       ├── service/         # 비즈니스 로직
  │   │   │       ├── repository/      # 데이터 접근 계층
  │   │   │       ├── entity/          # JPA 엔티티
  │   │   │       ├── dto/             # 데이터 전송 객체
  │   │   │       ├── security/        # 보안 관련
  │   │   │       └── exception/       # 예외 처리
  │   │   └── resources/
  │   │       ├── application.properties (또는 application.yml)
  │   │       └── application-dev.properties
  │   └── test/                        # 테스트 코드
  ├── build.gradle (또는 pom.xml)
  └── README.md
  ```

#### 1.2.3 환경 변수 및 설정 파일 관리
- [ ] **application.properties 또는 application.yml 생성**
  
  **application.yml 예시 (권장):**
  ```yaml
  spring:
    profiles:
      active: dev
    
    datasource:
      url: jdbc:mysql://localhost:3306/agriforecast?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
      username: ${DB_USERNAME:root}
      password: ${DB_PASSWORD:your_password}
      driver-class-name: com.mysql.cj.jdbc.Driver
    
    jpa:
      hibernate:
        ddl-auto: validate  # 개발: update, 프로덕션: validate 또는 none
      show-sql: true
      properties:
        hibernate:
          format_sql: true
          dialect: org.hibernate.dialect.MySQL8Dialect
    
    jackson:
      time-zone: Asia/Seoul
      date-format: yyyy-MM-dd HH:mm:ss

  server:
    port: 8080
    servlet:
      context-path: /api

  # JWT 설정 (나중에 추가)
  jwt:
    secret: ${JWT_SECRET:your-secret-key-change-in-production}
    expiration: 86400000  # 24시간 (밀리초)
  ```

- [ ] **환경별 설정 파일 분리**
  - `application-dev.yml` (로컬 개발)
  - `application-prod.yml` (프로덕션)
  - `.env` 파일 사용 시: `spring-dotenv` 라이브러리 추가

#### 1.2.4 Git 설정 및 브랜치 전략
- [ ] **Git 저장소 초기화**
  ```bash
  cd backend
  git init
  git add .
  git commit -m "Initial commit: Spring Boot project setup"
  ```

- [ ] **.gitignore 파일 확인/생성**
  ```
  # IDE
  .idea/
  *.iml
  .vscode/
  .eclipse/
  
  # Build
  target/
  build/
  *.class
  *.jar
  *.war
  
  # Logs
  *.log
  logs/
  
  # Environment
  .env
  application-local.properties
  
  # OS
  .DS_Store
  Thumbs.db
  ```

- [ ] **브랜치 전략 수립**
  ```
  main          # 프로덕션 배포용
  develop       # 개발 통합 브랜치
  feature/*     # 기능 개발 (예: feature/auth, feature/community)
  bugfix/*      # 버그 수정
  hotfix/*      # 긴급 수정
  ```

#### 1.2.5 의존성 확인 및 추가
- [ ] **build.gradle (Gradle) 또는 pom.xml (Maven) 확인**
  
  **필수 의존성 (build.gradle 예시):**
  ```gradle
  dependencies {
      // Spring Boot Starters
      implementation 'org.springframework.boot:spring-boot-starter-web'
      implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
      implementation 'org.springframework.boot:spring-boot-starter-security'
      implementation 'org.springframework.boot:spring-boot-starter-validation'
      
      // Database
      runtimeOnly 'com.mysql:mysql-connector-java'
      
      // JWT
      implementation 'io.jsonwebtoken:jjwt-api:0.12.3'
      implementation 'io.jsonwebtoken:jjwt-impl:0.12.3'
      implementation 'io.jsonwebtoken:jjwt-jackson:0.12.3'
      
      // Lombok (선택사항)
      compileOnly 'org.projectlombok:lombok'
      annotationProcessor 'org.projectlombok:lombok'
      
      // Development
      developmentOnly 'org.springframework.boot:spring-boot-devtools'
      
      // Test
      testImplementation 'org.springframework.boot:spring-boot-starter-test'
      testImplementation 'org.springframework.security:spring-security-test'
  }
  ```

- [ ] **의존성 다운로드**
  - Gradle: `./gradlew build` 또는 IDE에서 자동 다운로드
  - Maven: `mvn clean install` 또는 IDE에서 자동 다운로드

### 1.3 API 설계 문서 작성 (상세 가이드)

#### 1.3.1 API 엔드포인트 목록 작성
- [ ] **문서 형식 선택**
  - Markdown 파일 (예: `API_DESIGN.md`)
  - Excel/Google Sheets
  - Notion, Confluence 등 협업 도구

- [ ] **기본 API 구조 정의**
  ```
  Base URL: http://localhost:8080/api
  
  인증:
  - 인증 필요: Header에 "Authorization: Bearer {token}" 포함
  - 인증 불필요: Public API
  ```

- [ ] **각 API 엔드포인트 상세 작성 예시**
  
  **예시: 로그인 API**
  ```markdown
  ## POST /api/auth/login
  
  ### 설명
  사용자 로그인 및 JWT 토큰 발급
  
  ### 요청
  - **Headers**: Content-Type: application/json
  - **Body**:
    ```json
    {
      "username": "string (required)",
      "password": "string (required)"
    }
    ```
  
  ### 응답
  - **성공 (200 OK)**:
    ```json
    {
      "success": true,
      "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
          "id": 1,
          "username": "testuser",
          "email": "test@example.com",
          "fullname": "홍길동"
        }
      }
    }
    ```
  - **실패 (401 Unauthorized)**:
    ```json
    {
      "success": false,
      "error": {
        "code": "AUTH_001",
        "message": "아이디 또는 비밀번호가 올바르지 않습니다."
      }
    }
    ```
  ```

- [ ] **모든 API 엔드포인트 목록 작성**
  - 인증 API (로그인, 회원가입, 아이디 찾기 등)
  - 사용자 API
  - 가격 조회 API
  - 커뮤니티 API
  - 알림 API

#### 1.3.2 요청/응답 데이터 구조 정의
- [ ] **DTO (Data Transfer Object) 클래스 설계**
  
  **예시: LoginRequestDTO**
  ```java
  public class LoginRequestDTO {
      @NotBlank(message = "아이디는 필수입니다.")
      private String username;
      
      @NotBlank(message = "비밀번호는 필수입니다.")
      @Size(min = 6, message = "비밀번호는 최소 6자 이상이어야 합니다.")
      private String password;
      
      // Getters and Setters
  }
  ```

- [ ] **공통 응답 구조 정의**
  ```java
  public class ApiResponse<T> {
      private boolean success;
      private T data;
      private ErrorResponse error;
      private LocalDateTime timestamp;
      
      // 성공 응답 생성 메서드
      public static <T> ApiResponse<T> success(T data) {
          ApiResponse<T> response = new ApiResponse<>();
          response.setSuccess(true);
          response.setData(data);
          response.setTimestamp(LocalDateTime.now());
          return response;
      }
      
      // 실패 응답 생성 메서드
      public static <T> ApiResponse<T> error(String code, String message) {
          ApiResponse<T> response = new ApiResponse<>();
          response.setSuccess(false);
          response.setError(new ErrorResponse(code, message));
          response.setTimestamp(LocalDateTime.now());
          return response;
      }
  }
  ```

- [ ] **에러 응답 구조 정의**
  ```java
  public class ErrorResponse {
      private String code;      // 에러 코드 (예: "AUTH_001")
      private String message;   // 에러 메시지
      private Map<String, String> details; // 상세 정보 (선택사항)
  }
  ```

#### 1.3.3 API 문서화 도구 설정
- [ ] **Swagger/OpenAPI 설정 (권장)**
  
  **의존성 추가 (build.gradle):**
  ```gradle
  implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.3.0'
  ```
  
  **설정 클래스 생성:**
  ```java
  @Configuration
  public class SwaggerConfig {
      @Bean
      public OpenAPI agriForecastAPI() {
          return new OpenAPI()
              .info(new Info()
                  .title("AgriForecast API")
                  .description("농산물 가격 예측 플랫폼 API 문서")
                  .version("v1.0.0"))
              .servers(List.of(
                  new Server().url("http://localhost:8080").description("로컬 개발 서버"),
                  new Server().url("https://api.agriforecast.com").description("프로덕션 서버")
              ));
      }
  }
  ```
  
  **접속 URL**: http://localhost:8080/swagger-ui.html

- [ ] **Postman Collection 생성 (선택사항)**
  - Postman에서 Collection 생성
  - 각 API 엔드포인트 추가
  - 환경 변수 설정 (base_url, token 등)
  - 팀원과 공유

#### 1.3.4 에러 코드 및 메시지 표준 정의
- [ ] **에러 코드 체계 수립**
  
  **에러 코드 형식**: `{도메인}_{번호}`
  - 예: `AUTH_001`, `USER_001`, `PRICE_001` 등
  
  **예시 에러 코드 목록:**
  ```markdown
  ## 인증 관련 (AUTH_XXX)
  - AUTH_001: 아이디 또는 비밀번호가 올바르지 않습니다.
  - AUTH_002: 토큰이 만료되었습니다.
  - AUTH_003: 유효하지 않은 토큰입니다.
  - AUTH_004: 로그인이 필요합니다.
  
  ## 사용자 관련 (USER_XXX)
  - USER_001: 이미 존재하는 아이디입니다.
  - USER_002: 이미 존재하는 이메일입니다.
  - USER_003: 사용자를 찾을 수 없습니다.
  - USER_004: 비밀번호가 일치하지 않습니다.
  
  ## 가격 관련 (PRICE_XXX)
  - PRICE_001: 가격 데이터를 찾을 수 없습니다.
  - PRICE_002: 유효하지 않은 품목입니다.
  
  ## 커뮤니티 관련 (COMMUNITY_XXX)
  - COMMUNITY_001: 게시글을 찾을 수 없습니다.
  - COMMUNITY_002: 권한이 없습니다.
  - COMMUNITY_003: 댓글을 찾을 수 없습니다.
  
  ## 공통 (COMMON_XXX)
  - COMMON_001: 잘못된 요청입니다.
  - COMMON_002: 서버 오류가 발생했습니다.
  - COMMON_003: 유효성 검증 실패
  ```

- [ ] **에러 코드 Enum 클래스 생성**
  ```java
  @Getter
  @AllArgsConstructor
  public enum ErrorCode {
      // 인증
      AUTH_001("AUTH_001", "아이디 또는 비밀번호가 올바르지 않습니다."),
      AUTH_002("AUTH_002", "토큰이 만료되었습니다."),
      
      // 사용자
      USER_001("USER_001", "이미 존재하는 아이디입니다."),
      USER_002("USER_002", "이미 존재하는 이메일입니다."),
      
      // 공통
      COMMON_001("COMMON_001", "잘못된 요청입니다."),
      COMMON_002("COMMON_002", "서버 오류가 발생했습니다.");
      
      private final String code;
      private final String message;
  }
  ```

#### 1.3.5 API 설계 문서 템플릿
- [ ] **문서 구조 확정**
  ```markdown
  # AgriForecast API 설계 문서
  
  ## 목차
  1. 개요
  2. 기본 정보
  3. 인증
  4. API 엔드포인트
     - 인증 API
     - 사용자 API
     - 가격 조회 API
     - 커뮤니티 API
     - 알림 API
  5. 에러 코드
  6. 데이터 모델
  7. 변경 이력
  ```

- [ ] **문서 버전 관리**
  - 문서 파일명에 버전 포함 (예: `API_DESIGN_v1.0.md`)
  - 변경 이력 섹션에 변경 사항 기록

---

## 2단계: 데이터베이스 설계 및 구축

### 2.1 데이터베이스 스키마 설계

#### 2.1.1 ERD (Entity Relationship Diagram) 작성
- [ ] **도구 선택**
  - MySQL Workbench (ERD 기능)
  - draw.io / diagrams.net
  - ERDCloud
  - 기타 ERD 도구
- [ ] **테이블 간 관계 정의**
  - Users ↔ Posts (1:N)
  - Users ↔ Comments (1:N)
  - Products ↔ Prices (1:N)
  - Products ↔ PricePredictions (1:N)
  - Users ↔ Notifications (1:N)
  - Posts ↔ Comments (1:N)

#### 2.1.2 각 테이블 상세 설계

- [ ] **사용자 테이블 (users)**
  ```sql
  CREATE TABLE users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE COMMENT '사용자 아이디',
      email VARCHAR(100) NOT NULL UNIQUE COMMENT '이메일',
      password_hash VARCHAR(255) NOT NULL COMMENT '비밀번호 해시',
      fullname VARCHAR(100) NOT NULL COMMENT '이름',
      phone VARCHAR(20) COMMENT '연락처',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **농산물 정보 테이블 (products)**
  ```sql
  CREATE TABLE products (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL COMMENT '품목명',
      category VARCHAR(50) NOT NULL COMMENT '카테고리 (야채류, 과일류, 곡물류 등)',
      unit VARCHAR(20) NOT NULL COMMENT '단위 (10kg, 1kg 등)',
      description TEXT COMMENT '설명',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_category (category)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **가격 데이터 테이블 (prices)**
  ```sql
  CREATE TABLE prices (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      product_id BIGINT NOT NULL COMMENT '품목 ID',
      price DECIMAL(10, 2) NOT NULL COMMENT '가격',
      date DATE NOT NULL COMMENT '날짜',
      source VARCHAR(100) COMMENT '데이터 출처',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      INDEX idx_product_id (product_id),
      INDEX idx_date (date),
      INDEX idx_product_date (product_id, date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **가격 예측 데이터 테이블 (price_predictions)**
  ```sql
  CREATE TABLE price_predictions (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      product_id BIGINT NOT NULL COMMENT '품목 ID',
      predicted_price DECIMAL(10, 2) NOT NULL COMMENT '예측 가격',
      prediction_date DATE NOT NULL COMMENT '예측 날짜',
      confidence DECIMAL(5, 2) COMMENT '신뢰도 (0-100)',
      model_version VARCHAR(50) COMMENT '모델 버전',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      INDEX idx_product_id (product_id),
      INDEX idx_prediction_date (prediction_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **커뮤니티 게시글 테이블 (posts)**
  ```sql
  CREATE TABLE posts (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL COMMENT '작성자 ID',
      title VARCHAR(200) NOT NULL COMMENT '제목',
      category VARCHAR(50) NOT NULL COMMENT '카테고리 (도매정보, 소매노하우, 구인구직, 자유게시판)',
      content TEXT NOT NULL COMMENT '내용',
      view_count INT NOT NULL DEFAULT 0 COMMENT '조회수',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_category (category),
      INDEX idx_created_at (created_at),
      INDEX idx_category_created (category, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **댓글 테이블 (comments)**
  ```sql
  CREATE TABLE comments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      post_id BIGINT NOT NULL COMMENT '게시글 ID',
      user_id BIGINT NOT NULL COMMENT '작성자 ID',
      content TEXT NOT NULL COMMENT '댓글 내용',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_post_id (post_id),
      INDEX idx_user_id (user_id),
      INDEX idx_post_created (post_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **알림 테이블 (notifications)**
  ```sql
  CREATE TABLE notifications (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NOT NULL COMMENT '사용자 ID',
      product_id BIGINT NOT NULL COMMENT '품목 ID',
      target_price DECIMAL(10, 2) NOT NULL COMMENT '목표 가격',
      notification_type VARCHAR(20) NOT NULL DEFAULT 'PRICE' COMMENT '알림 타입',
      is_read BOOLEAN NOT NULL DEFAULT FALSE COMMENT '읽음 여부',
      reached_at TIMESTAMP NULL COMMENT '목표 가격 도달 시각',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      INDEX idx_user_id (user_id),
      INDEX idx_is_read (is_read),
      INDEX idx_user_read (user_id, is_read)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **알림 발송 이력 테이블 (notification_logs)**
  ```sql
  CREATE TABLE notification_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      notification_id BIGINT NOT NULL COMMENT '알림 ID',
      sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '발송 시각',
      delivery_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' COMMENT '발송 상태 (PENDING, SUCCESS, FAILED)',
      delivery_method VARCHAR(20) COMMENT '발송 방법 (EMAIL, SMS, PUSH)',
      error_message TEXT COMMENT '에러 메시지',
      FOREIGN KEY (notification_id) REFERENCES notifications(id) ON DELETE CASCADE,
      INDEX idx_notification_id (notification_id),
      INDEX idx_sent_at (sent_at),
      INDEX idx_status (delivery_status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

#### 2.1.3 추가 고려사항
- [ ] **소프트 삭제 (Soft Delete) 고려**
  - `deleted_at` 컬럼 추가 여부 결정
  - 물리적 삭제 vs 논리적 삭제
- [ ] **타임존 설정**
  - 모든 TIMESTAMP 컬럼에 타임존 명시
  - 애플리케이션에서 Asia/Seoul 사용
- [ ] **문자 인코딩**
  - UTF-8 (utf8mb4) 사용으로 이모지 지원

### 2.2 데이터베이스 구축 (MySQL)

#### 2.2.1 MySQL 설치 및 설정
- [ ] **MySQL 서버 설치**
  - Windows: MySQL Installer 다운로드 및 설치
    - https://dev.mysql.com/downloads/installer/
    - 설치 시 Root 비밀번호 설정
  - macOS: Homebrew 사용
    ```bash
    brew install mysql
    brew services start mysql
    ```
  - Linux: 패키지 매니저 사용
    ```bash
    sudo apt-get update
    sudo apt-get install mysql-server
    ```

- [ ] **MySQL 설치 확인**
  ```bash
  mysql --version
  # 또는
  mysql -u root -p
  ```

- [ ] **MySQL 서비스 시작 확인**
  - Windows: 서비스 관리자에서 MySQL 서비스 확인
  - macOS/Linux: `brew services list` 또는 `systemctl status mysql`

#### 2.2.2 데이터베이스 및 사용자 생성
- [ ] **MySQL 접속**
  ```bash
  mysql -u root -p
  ```

- [ ] **데이터베이스 생성**
  ```sql
  CREATE DATABASE agriforecast 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;
  
  -- 데이터베이스 확인
  SHOW DATABASES;
  
  -- 사용할 데이터베이스 선택
  USE agriforecast;
  ```

- [ ] **전용 사용자 생성 및 권한 부여 (권장)**
  ```sql
  -- 사용자 생성
  CREATE USER 'agriforecast_user'@'localhost' IDENTIFIED BY 'your_secure_password';
  
  -- 권한 부여
  GRANT ALL PRIVILEGES ON agriforecast.* TO 'agriforecast_user'@'localhost';
  
  -- 권한 새로고침
  FLUSH PRIVILEGES;
  
  -- 사용자 확인
  SELECT user, host FROM mysql.user;
  ```

- [ ] **Spring Boot application.yml에 데이터베이스 연결 정보 설정**
  ```yaml
  spring:
    datasource:
      url: jdbc:mysql://localhost:3306/agriforecast?useSSL=false&serverTimezone=Asia/Seoul&characterEncoding=UTF-8
      username: agriforecast_user
      password: your_secure_password
      driver-class-name: com.mysql.cj.jdbc.Driver
  ```

#### 2.2.3 초기 스키마 생성
- [ ] **방법 1: Flyway 마이그레이션 사용 (권장)**
  
  **의존성 추가:**
  ```gradle
  implementation 'org.flywaydb:flyway-core'
  implementation 'org.flywaydb:flyway-mysql'
  ```
  
  **폴더 생성:**
  - `src/main/resources/db/migration/` 폴더 생성
  
  **마이그레이션 파일 생성:**
  - `V1__Create_users_table.sql`
  - `V2__Create_products_table.sql`
  - `V3__Create_prices_table.sql`
  - 등등...
  
  **예시: V1__Create_users_table.sql**
  ```sql
  CREATE TABLE users (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      email VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      fullname VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_username (username),
      INDEX idx_email (email)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```

- [ ] **방법 2: JPA DDL 사용 (개발용만)**
  ```yaml
  spring:
    jpa:
      hibernate:
        ddl-auto: update  # 개발용만, 프로덕션에서는 사용하지 않음
  ```
  - Entity 클래스 기반으로 자동 테이블 생성
  - 프로덕션에서는 권장하지 않음

#### 2.2.4 시드 데이터 (초기 데이터) 생성
- [ ] **시드 데이터 SQL 파일 생성**
  - `src/main/resources/db/migration/V100__Insert_seed_data.sql` (Flyway 사용 시)
  - 또는 별도 SQL 파일 생성
  
  **예시: 테스트용 농산물 데이터**
  ```sql
  INSERT INTO products (name, category, unit, description) VALUES
  ('배추', '야채류', '10kg', '배추 가격 정보'),
  ('사과', '과일류', '10kg', '사과 가격 정보'),
  ('쌀', '곡물류', '20kg', '쌀 가격 정보'),
  ('돼지고기', '축산물', '1kg', '돼지고기 가격 정보'),
  ('고등어', '수산물', '1kg', '고등어 가격 정보');
  
  -- 테스트용 사용자 (비밀번호: test1234, 해시화 필요)
  INSERT INTO users (username, email, password_hash, fullname) VALUES
  ('testuser', 'test@example.com', '$2a$10$...', '테스트 사용자');
  ```

- [ ] **또는 Java 기반 시드 데이터 생성**
  - `@Component` 클래스에서 `CommandLineRunner` 구현
  - 애플리케이션 시작 시 자동 실행

#### 2.2.5 데이터베이스 연결 테스트
- [ ] **Spring Boot 애플리케이션 실행**
  ```bash
  ./gradlew bootRun
  # 또는
  mvn spring-boot:run
  # 또는 IDE에서 BackendApplication 실행
  ```

- [ ] **연결 확인**
  - 콘솔에 "HikariPool-1 - Starting..." 메시지 확인
  - 에러 없이 애플리케이션 시작 확인
  - MySQL에서 테이블 생성 확인:
    ```sql
    USE agriforecast;
    SHOW TABLES;
    DESCRIBE users;
    ```

- [ ] **MySQL Workbench 또는 DBeaver로 연결 테스트**
  - GUI 도구에서 데이터베이스 연결 확인
  - 테이블 구조 확인
  - 데이터 조회/삽입 테스트

### 2.3 JPA 엔티티 및 관계 설정
- [ ] **JPA 엔티티 클래스 생성**
  - 각 테이블에 대응하는 Entity 클래스 작성
  - `@Entity`, `@Table` 어노테이션 사용
  - 필드에 `@Column`, `@Id`, `@GeneratedValue` 등 설정
  
  **예시: User 엔티티**
  ```java
  @Entity
  @Table(name = "users")
  @Getter
  @Setter
  @NoArgsConstructor
  public class User {
      @Id
      @GeneratedValue(strategy = GenerationType.IDENTITY)
      private Long id;
      
      @Column(unique = true, nullable = false, length = 50)
      private String username;
      
      @Column(unique = true, nullable = false)
      private String email;
      
      @Column(nullable = false)
      private String passwordHash;
      
      @Column(nullable = false)
      private String fullname;
      
      @CreationTimestamp
      @Column(nullable = false, updatable = false)
      private LocalDateTime createdAt;
      
      @UpdateTimestamp
      @Column(nullable = false)
      private LocalDateTime updatedAt;
  }
  ```

- [ ] **엔티티 간 관계 설정**
  - `@OneToMany`, `@ManyToOne`, `@OneToOne`, `@ManyToMany` 사용
  - 양방향 관계 시 순환 참조 방지 (`@JsonIgnore` 등)
  
  **예시: Post와 User 관계**
  ```java
  // Post 엔티티
  @ManyToOne(fetch = FetchType.LAZY)
  @JoinColumn(name = "user_id", nullable = false)
  private User user;
  
  // User 엔티티
  @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
  private List<Post> posts = new ArrayList<>();
  ```

- [ ] **Repository 인터페이스 생성**
  - `JpaRepository<Entity, ID>` 상속
  - 커스텀 쿼리 메서드 작성 (필요시)
  
  **예시: UserRepository**
  ```java
  @Repository
  public interface UserRepository extends JpaRepository<User, Long> {
      Optional<User> findByUsername(String username);
      Optional<User> findByEmail(String email);
      boolean existsByUsername(String username);
      boolean existsByEmail(String email);
  }
  ```

- [ ] **Flyway 또는 Liquibase 설정 (마이그레이션 도구)**
  
  **Flyway 사용 (권장):**
  - 의존성 추가: `implementation 'org.flywaydb:flyway-core'`
  - `src/main/resources/db/migration/` 폴더 생성
  - SQL 파일 생성: `V1__Create_users_table.sql`
  
  **또는 JPA DDL 사용:**
  - `spring.jpa.hibernate.ddl-auto: update` (개발용)
  - 프로덕션에서는 `validate` 또는 `none` 사용

---

## 3단계: 백엔드 서버 구축

### 3.1 기본 서버 구조 설정
- [ ] **프로젝트 폴더 구조 생성 (Spring Boot 표준 구조)**
  ```
  backend/
  ├── src/
  │   ├── main/
  │   │   ├── java/com/agriforecast/backend/
  │   │   │   ├── BackendApplication.java
  │   │   │   ├── config/              # 설정 클래스
  │   │   │   │   ├── SecurityConfig.java
  │   │   │   │   ├── SwaggerConfig.java
  │   │   │   │   └── WebConfig.java
  │   │   │   ├── controller/          # REST 컨트롤러
  │   │   │   │   ├── AuthController.java
  │   │   │   │   ├── UserController.java
  │   │   │   │   ├── PriceController.java
  │   │   │   │   └── CommunityController.java
  │   │   │   ├── service/             # 비즈니스 로직
  │   │   │   │   ├── AuthService.java
  │   │   │   │   ├── UserService.java
  │   │   │   │   └── PriceService.java
  │   │   │   ├── repository/          # 데이터 접근 계층
  │   │   │   │   ├── UserRepository.java
  │   │   │   │   └── ProductRepository.java
  │   │   │   ├── entity/              # JPA 엔티티
  │   │   │   │   ├── User.java
  │   │   │   │   ├── Product.java
  │   │   │   │   └── Post.java
  │   │   │   ├── dto/                 # 데이터 전송 객체
  │   │   │   │   ├── request/
  │   │   │   │   │   ├── LoginRequestDTO.java
  │   │   │   │   │   └── SignupRequestDTO.java
  │   │   │   │   └── response/
  │   │   │   │       ├── ApiResponse.java
  │   │   │   │       └── UserResponseDTO.java
  │   │   │   ├── security/            # 보안 관련
  │   │   │   │   ├── JwtTokenProvider.java
  │   │   │   │   ├── JwtAuthenticationFilter.java
  │   │   │   │   └── UserDetailsServiceImpl.java
  │   │   │   ├── exception/           # 예외 처리
  │   │   │   │   ├── GlobalExceptionHandler.java
  │   │   │   │   ├── ErrorCode.java
  │   │   │   │   └── BusinessException.java
  │   │   │   └── util/                # 유틸리티
  │   │   │       └── PasswordEncoder.java
  │   │   └── resources/
  │   │       ├── application.yml
  │   │       ├── application-dev.yml
  │   │       ├── application-prod.yml
  │   │       └── db/migration/        # Flyway 마이그레이션 파일
  │   └── test/                         # 테스트 코드
  │       └── java/com/agriforecast/backend/
  ├── build.gradle (또는 pom.xml)
  └── README.md
  ```

- [ ] **의존성 확인 (build.gradle 또는 pom.xml)**
  - Spring Boot Starter Web
  - Spring Data JPA
  - MySQL Driver
  - Spring Security
  - JWT 라이브러리
  - Validation
  - Lombok (선택사항)
  - Spring Boot DevTools (개발용)

- [ ] **기본 설정 클래스 생성**
  - `WebConfig.java`: CORS 설정
  - `SecurityConfig.java`: Spring Security 설정 (초기에는 임시로 모든 요청 허용)
  - `GlobalExceptionHandler.java`: 전역 예외 처리

### 3.2 기본 설정 및 미들웨어
- [ ] **CORS 설정 (WebConfig)**
  ```java
  @Configuration
  public class WebConfig implements WebMvcConfigurer {
      @Override
      public void addCorsMappings(CorsRegistry registry) {
          registry.addMapping("/api/**")
                  .allowedOrigins("http://localhost:5173") // Vite 기본 포트
                  .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                  .allowedHeaders("*")
                  .allowCredentials(true);
      }
  }
  ```

- [ ] **전역 예외 처리 (GlobalExceptionHandler)**
  ```java
  @RestControllerAdvice
  public class GlobalExceptionHandler {
      @ExceptionHandler(MethodArgumentNotValidException.class)
      public ResponseEntity<ApiResponse<?>> handleValidationException(
          MethodArgumentNotValidException e) {
          // 유효성 검증 에러 처리
      }
      
      @ExceptionHandler(BusinessException.class)
      public ResponseEntity<ApiResponse<?>> handleBusinessException(
          BusinessException e) {
          // 비즈니스 로직 에러 처리
      }
      
      @ExceptionHandler(Exception.class)
      public ResponseEntity<ApiResponse<?>> handleException(Exception e) {
          // 기타 예외 처리
      }
  }
  ```

- [ ] **로깅 설정**
  - `application.yml`에 로깅 레벨 설정
  - Logback 설정 파일 생성 (선택사항)
  
  ```yaml
  logging:
    level:
      root: INFO
      com.agriforecast.backend: DEBUG
    file:
      name: logs/application.log
  ```

- [ ] **요청 유효성 검증**
  - DTO 클래스에 `@Valid`, `@NotNull`, `@NotBlank` 등 사용
  - Controller 메서드에 `@Valid` 어노테이션 추가

### 3.3 인증 시스템 구현
- [ ] **비밀번호 해싱 설정**
  - Spring Security의 `BCryptPasswordEncoder` 사용
  - Config 클래스에 Bean 등록
  
  ```java
  @Configuration
  public class SecurityConfig {
      @Bean
      public PasswordEncoder passwordEncoder() {
          return new BCryptPasswordEncoder();
      }
  }
  ```

- [ ] **JWT 토큰 Provider 구현**
  - `JwtTokenProvider` 클래스 생성
  - 토큰 생성, 검증, 토큰에서 사용자 정보 추출 메서드 구현
  - Access Token, Refresh Token 구분

- [ ] **Spring Security 설정**
  - `SecurityConfig` 클래스에서 인증/인가 규칙 설정
  - Public API와 Protected API 구분
  - JWT 필터 추가

- [ ] **인증 API 구현**
  - `AuthController` 생성
  - `AuthService` 생성 (비즈니스 로직)
  - 각 API 엔드포인트 구현:
    - `POST /api/auth/login`
    - `POST /api/auth/signup`
    - `POST /api/auth/find-id`
    - `POST /api/auth/reset-password`
    - `POST /api/auth/logout`
    - `POST /api/auth/refresh`

- [ ] **JWT 인증 필터 구현**
  - `JwtAuthenticationFilter` 생성
  - 요청 헤더에서 토큰 추출
  - 토큰 검증 및 SecurityContext에 인증 정보 설정

- [ ] **UserDetailsService 구현**
  - Spring Security의 `UserDetailsService` 인터페이스 구현
  - 사용자 정보 조회 로직

---

## 4단계: 핵심 API 구현

### 4.1 사용자 관리 API
- [ ] 사용자 정보 조회 (`GET /api/users/me`)
- [ ] 사용자 정보 수정 (`PUT /api/users/me`)
- [ ] 비밀번호 변경 (`PUT /api/users/me/password`)
- [ ] 계정 탈퇴 (`DELETE /api/users/me`)

### 4.2 농산물 가격 API
- [ ] 실시간 가격 조회 (`GET /api/prices/current`)
  - 주요 품목별 현재 가격
  - 전일 대비 등락률 계산
- [ ] 상세 가격 조회 (`GET /api/prices/detail`)
  - 필터링 (품목, 기간, 단위)
  - KPI 계산 (평균, 최고, 최저)
- [ ] 가격 데이터 저장 API (관리자용)
  - 외부 데이터 소스 연동 또는 수동 입력

### 4.3 가격 예측 API
- [ ] 예측 모델 통합
  - Python ML 모델 (LSTM, ARIMA 등) 또는
  - Node.js 기반 예측 로직
- [ ] 예측 결과 조회 (`GET /api/prices/predictions`)
  - 품목별, 기간별 예측
  - 캐싱 전략 구현
- [ ] 예측 모델 학습 스케줄링 (선택사항)
  - 주기적 재학습
  - 배치 작업 설정

### 4.4 커뮤니티 API
- [ ] 게시글 목록 조회 (`GET /api/community/posts`)
  - 페이지네이션
  - 필터링 (카테고리)
  - 정렬
- [ ] 게시글 작성 (`POST /api/community/posts`)
  - 파일 업로드 처리 (선택사항)
- [ ] 게시글 상세 조회 (`GET /api/community/posts/:id`)
  - 조회수 증가
- [ ] 게시글 수정 (`PUT /api/community/posts/:id`)
  - 권한 확인 (작성자만)
- [ ] 게시글 삭제 (`DELETE /api/community/posts/:id`)
- [ ] 댓글 작성 (`POST /api/community/posts/:id/comments`)
- [ ] 댓글 목록 조회 (`GET /api/community/posts/:id/comments`)
- [ ] 댓글 수정/삭제 (`PUT/DELETE /api/community/comments/:id`)

### 4.5 알림 API
- [ ] 알림 등록 (`POST /api/notifications`)
- [ ] 받은 알림 목록 (`GET /api/notifications/received`)
- [ ] 등록된 알림 목록 (`GET /api/notifications/registered`)
- [ ] 알림 삭제 (`DELETE /api/notifications/:id`)
- [ ] 알림 읽음 처리 (`PUT /api/notifications/:id/read`)
- [ ] 알림 발송 로직 구현
  - 가격 모니터링 스케줄러
  - 이메일/SMS 발송 (선택사항)

---

## 5단계: 외부 데이터 연동

### 5.1 농산물 가격 데이터 소스 확보
- [ ] 공공 데이터 API 연동
  - 한국농수산식품유통공사 (aT) API
  - 농림축산식품부 API
  - 기타 공공 데이터 포털
- [ ] 데이터 수집 스크립트 작성
  - 주기적 데이터 수집 (Cron Job, 스케줄러)
  - 데이터 정제 및 변환
- [ ] 데이터 저장 로직 구현

### 5.2 기상 데이터 연동 (예측 모델용, 선택사항)
- [ ] 기상청 API 연동
- [ ] 기상 데이터 수집 및 저장
- [ ] 예측 모델 입력 데이터 준비

---

## 6단계: 프론트엔드-백엔드 연동

### 6.1 API 클라이언트 설정
- [ ] HTTP 클라이언트 라이브러리 설치
  - axios, fetch API 등
- [ ] API 기본 URL 설정 (환경 변수)
- [ ] 요청/응답 인터셉터 설정
  - 토큰 자동 첨부
  - 에러 처리
  - 로딩 상태 관리

### 6.2 인증 연동
- [ ] 로그인 API 연동
- [ ] 회원가입 API 연동
- [ ] 토큰 저장 및 관리 (localStorage 또는 httpOnly cookie)
- [ ] 토큰 만료 시 자동 갱신 로직
- [ ] 로그아웃 API 연동

### 6.3 각 페이지별 API 연동
- [ ] 홈 페이지
  - 실시간 가격 데이터 조회
  - 예측 차트 데이터 조회
- [ ] 상세 검색 페이지
  - 필터링된 가격 데이터 조회
- [ ] 커뮤니티 페이지
  - 게시글 목록 조회
  - 게시글 작성/수정/삭제
  - 댓글 기능
- [ ] 마이페이지
  - 사용자 정보 조회/수정
  - 알림 목록 조회

---

## 7단계: 보안 강화

### 7.1 인증 보안
- [ ] 비밀번호 정책 강화 (최소 길이, 복잡도)
- [ ] 로그인 시도 제한 (Rate Limiting)
- [ ] CSRF 토큰 구현
- [ ] XSS 방지 (입력값 검증 및 이스케이프)

### 7.2 API 보안
- [ ] Rate Limiting 적용
- [ ] 입력값 검증 및 Sanitization
- [ ] SQL Injection 방지 (ORM 사용 또는 Prepared Statement)
- [ ] 민감 정보 암호화 (환경 변수, 데이터베이스)

### 7.3 데이터 보안
- [ ] HTTPS 설정 (프로덕션)
- [ ] 데이터베이스 백업 전략
- [ ] 개인정보 보호 (GDPR 준수, 선택사항)

---

## 8단계: 성능 최적화

### 8.1 데이터베이스 최적화
- [ ] 인덱스 최적화
- [ ] 쿼리 성능 분석 및 최적화
- [ ] 연결 풀 설정
- [ ] 캐싱 전략 (Redis, 선택사항)

### 8.2 API 최적화
- [ ] 응답 데이터 최적화 (필요한 필드만)
- [ ] 페이지네이션 최적화
- [ ] 예측 결과 캐싱
- [ ] 이미지 최적화 (CDN, 선택사항)

### 8.3 프론트엔드 최적화
- [ ] 코드 스플리팅
- [ ] 이미지 지연 로딩
- [ ] API 호출 최적화 (중복 요청 방지)

---

## 9단계: 테스트

### 9.1 백엔드 테스트
- [ ] 단위 테스트 작성
  - 각 API 엔드포인트
  - 비즈니스 로직
- [ ] 통합 테스트 작성
- [ ] 인증/인가 테스트
- [ ] 에러 케이스 테스트

### 9.2 프론트엔드 테스트
- [ ] 컴포넌트 테스트
- [ ] API 연동 테스트
- [ ] 사용자 플로우 테스트

### 9.3 E2E 테스트 (선택사항)
- [ ] 주요 시나리오 테스트
- [ ] 크로스 브라우저 테스트

---

## 10단계: 배포 준비

### 10.1 환경 설정
- [ ] 프로덕션 환경 변수 설정
- [ ] 데이터베이스 프로덕션 설정
- [ ] 로깅 시스템 설정
- [ ] 모니터링 도구 설정 (선택사항)

### 10.2 배포 인프라 구축
- [ ] 서버 선택 및 설정
  - 클라우드 (AWS, GCP, Azure 등)
  - VPS
  - 기타
- [ ] 도메인 설정
- [ ] SSL 인증서 설정
- [ ] 리버스 프록시 설정 (Nginx, 선택사항)

### 10.3 CI/CD 파이프라인 구축 (선택사항)
- [ ] 자동 빌드 설정
- [ ] 자동 테스트 실행
- [ ] 자동 배포 설정

### 10.4 문서화
- [ ] API 문서 최종 정리
- [ ] 배포 가이드 작성
- [ ] 운영 매뉴얼 작성

---

## 11단계: 배포 및 모니터링

### 11.1 초기 배포
- [ ] 백엔드 서버 배포
- [ ] 프론트엔드 빌드 및 배포
- [ ] 데이터베이스 마이그레이션 실행
- [ ] 초기 데이터 시드

### 11.2 모니터링 설정
- [ ] 서버 리소스 모니터링
- [ ] API 응답 시간 모니터링
- [ ] 에러 로그 모니터링
- [ ] 사용자 활동 모니터링 (선택사항)

### 11.3 백업 전략
- [ ] 데이터베이스 자동 백업 설정
- [ ] 백업 복구 테스트

---

## 12단계: 운영 및 유지보수

### 12.1 초기 운영
- [ ] 사용자 피드백 수집
- [ ] 버그 수정
- [ ] 성능 모니터링 및 개선

### 12.2 기능 개선
- [ ] 사용자 요청 기능 추가
- [ ] 예측 모델 정확도 개선
- [ ] UI/UX 개선

### 12.3 확장성 고려
- [ ] 서버 스케일링 계획
- [ ] 데이터베이스 스케일링 계획
- [ ] 로드 밸런싱 (선택사항)

---

## 📌 우선순위 참고사항

### P0 (최우선)
1. 데이터베이스 설계 및 구축
2. 기본 인증 시스템 (로그인/회원가입)
3. 핵심 API 구현 (가격 조회, 커뮤니티)
4. 프론트엔드-백엔드 연동

### P1 (높음)
1. 가격 예측 모델 통합
2. 알림 시스템
3. 보안 강화
4. 성능 최적화

### P2 (중간)
1. 외부 데이터 연동
2. 테스트 작성
3. 모니터링 설정

### P3 (낮음)
1. CI/CD 파이프라인
2. 고급 기능 (이메일 발송 등)
3. 확장성 개선

---

## 📝 참고사항

- 각 단계는 순차적으로 진행하되, 필요시 병렬 작업 가능
- 각 단계 완료 후 테스트 및 검증 필수
- 코드 리뷰 및 문서화를 병행하여 진행 권장
- 팀원 간 역할 분담 및 커뮤니케이션 중요

---

**작성일**: 2025년 12월
**프로젝트**: AgriForecast (농산물 가격 예측 플랫폼)  
**현재 상태**: 프론트엔드 완료, 백엔드/데이터베이스 미구축

