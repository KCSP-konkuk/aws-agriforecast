package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.LoginRequest;
import com.agriforecast.backend.dto.LoginResponse;
import com.agriforecast.backend.dto.SignupRequest;
import com.agriforecast.backend.dto.SignupResponse;
import com.agriforecast.backend.entity.AuthPassword;
import com.agriforecast.backend.entity.MemberProfile;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.AuthPasswordRepository;
import com.agriforecast.backend.repository.MemberUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

@Service
@Transactional
public class AuthService {
    
    private static final Logger logger = LoggerFactory.getLogger(AuthService.class);
    
    @Autowired
    private MemberUserRepository memberUserRepository;
    
    @Autowired
    private AuthPasswordRepository authPasswordRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    public LoginResponse login(LoginRequest request) {
        logger.info("로그인 시도 - 아이디: {}", request.getUsername());
        
        // 1. 사용자 찾기
        Optional<MemberUser> userOpt = memberUserRepository.findByUserId(request.getUsername());
        
        if (userOpt.isEmpty()) {
            logger.warn("사용자를 찾을 수 없음 - 아이디: {}", request.getUsername());
            return new LoginResponse(false, "아이디 또는 비밀번호가 올바르지 않습니다.", null);
        }
        
        MemberUser user = userOpt.get();
        logger.info("사용자 찾음 - SEQ_NO_A010: {}, ID: {}", user.getSeqNoA010(), user.getId());
        
        // 2. 활성 여부 확인
        if (!user.getIsActive()) {
            logger.warn("비활성화된 계정 - 아이디: {}", request.getUsername());
            return new LoginResponse(false, "비활성화된 계정입니다.", null);
        }
        
        // 3. 비밀번호 확인
        Optional<AuthPassword> authPasswordOpt = authPasswordRepository.findByMemberUser(user);
        
        if (authPasswordOpt.isEmpty()) {
            logger.warn("비밀번호 정보를 찾을 수 없음 - SEQ_NO_A010: {}", user.getSeqNoA010());
            return new LoginResponse(false, "비밀번호 정보를 찾을 수 없습니다.", null);
        }
        
        AuthPassword authPassword = authPasswordOpt.get();
        logger.info("비밀번호 정보 찾음 - 저장된 해시: {}", authPassword.getPassword().substring(0, Math.min(20, authPassword.getPassword().length())) + "...");
        
        // 4. 비밀번호 검증
        String storedPassword = authPassword.getPassword();
        String inputPassword = request.getPassword();
        
        // BCrypt를 사용한 비밀번호 검증
        boolean matches = passwordEncoder.matches(inputPassword, storedPassword);
        logger.info("비밀번호 검증 결과: {}", matches);
        
        if (!matches) {
            logger.warn("비밀번호 불일치 - 아이디: {}", request.getUsername());
            return new LoginResponse(false, "아이디 또는 비밀번호가 올바르지 않습니다.", null);
        }
        
        // 5. 프로필 정보 가져오기
        MemberProfile profile = user.getMemberProfile();
        
        // 6. 응답 생성
        LoginResponse.UserInfo userInfo = new LoginResponse.UserInfo();
        userInfo.setSeqNoA010(user.getSeqNoA010());
        userInfo.setId(user.getId());
        userInfo.setName(profile != null ? profile.getName() : "");
        userInfo.setEmail(profile != null ? profile.getEmail() : "");
        
        logger.info("로그인 성공 - 아이디: {}, 이름: {}", user.getId(), userInfo.getName());
        return new LoginResponse(true, "로그인 성공", userInfo);
    }
    
    public SignupResponse signup(SignupRequest request) {
        logger.info("회원가입 시도 - 아이디: {}, 이름: {}", request.getUsername(), request.getFullname());
        
        // 1. 아이디 중복 체크
        if (memberUserRepository.existsByUserId(request.getUsername())) {
            logger.warn("이미 존재하는 아이디 - 아이디: {}", request.getUsername());
            return new SignupResponse(false, "이미 존재하는 아이디입니다.");
        }
        
        // 2. 사용자 생성
        MemberUser user = new MemberUser();
        user.setId(request.getUsername());
        user.setIsActive(true);
        
        // 3. 비밀번호 해싱
        String hashedPassword = passwordEncoder.encode(request.getPassword());
        
        // 4. SALT 생성 (BCrypt는 자체 salt를 포함하지만, DB 스키마에 맞춰 랜덤 값 생성)
        SecureRandom random = new SecureRandom();
        byte[] saltBytes = new byte[16];
        random.nextBytes(saltBytes);
        String salt = Base64.getEncoder().encodeToString(saltBytes);
        
        // 5. AuthPassword 생성
        AuthPassword authPassword = new AuthPassword();
        authPassword.setMemberUser(user);
        authPassword.setSalt(salt);
        authPassword.setPassword(hashedPassword);
        
        // 6. MemberProfile 생성
        MemberProfile profile = new MemberProfile();
        profile.setMemberUser(user);
        profile.setName(request.getFullname());
        profile.setEmail(request.getEmail());
        
        // 7. 관계 설정 및 저장
        user.setAuthPassword(authPassword);
        user.setMemberProfile(profile);
        
        try {
            memberUserRepository.save(user);
            logger.info("회원가입 성공 - 아이디: {}, 이름: {}", user.getId(), profile.getName());
            return new SignupResponse(true, "회원가입이 완료되었습니다.");
        } catch (Exception e) {
            logger.error("회원가입 실패 - 아이디: {}, 에러: {}", request.getUsername(), e.getMessage());
            return new SignupResponse(false, "회원가입 중 오류가 발생했습니다.");
        }
    }
}

