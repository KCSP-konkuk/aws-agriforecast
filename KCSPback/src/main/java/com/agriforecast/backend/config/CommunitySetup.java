package com.agriforecast.backend.config;

import com.agriforecast.backend.entity.AuthPassword;
import com.agriforecast.backend.entity.MemberProfile;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import com.agriforecast.backend.service.CommunityVoteService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.List;

/** 커뮤니티 품목방 준비: 브리핑 작성자 시스템 계정, 옛 카테고리 글을 '자유'로 (둘 다 멱등) */
@Component
public class CommunitySetup {

    public static final String SYSTEM_ID = "agriforecast";
    static final String SYSTEM_NAME = "AgriForecast";

    /** 게시글 방 = category 값. 프론트 src/community.js 의 ROOMS 와 같아야 한다 */
    public static final List<String> ROOMS = java.util.stream.Stream
            .concat(CommunityVoteService.VOTE_ITEMS.stream(), java.util.stream.Stream.of("자유")).toList();
    private static final Logger logger = LoggerFactory.getLogger(CommunitySetup.class);

    private final MemberUserRepository memberUserRepository;
    private final PostRepository postRepository;
    private final PasswordEncoder passwordEncoder;

    public CommunitySetup(MemberUserRepository memberUserRepository, PostRepository postRepository,
                          PasswordEncoder passwordEncoder) {
        this.memberUserRepository = memberUserRepository;
        this.postRepository = postRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /** 이 아이디가 우리가 만든 시스템 계정인지 (같은 아이디로 먼저 가입한 사람이면 false) */
    public static boolean isSystemAccount(MemberUser user) {
        MemberProfile p = user == null ? null : user.getMemberProfile();
        return p != null && SYSTEM_NAME.equals(p.getName()) && p.getEmail() == null;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void prepare() {
        if (memberUserRepository.findByUserId(SYSTEM_ID).isEmpty()) {
            SecureRandom random = new SecureRandom();
            byte[] secret = new byte[32];
            random.nextBytes(secret);
            byte[] salt = new byte[16];
            random.nextBytes(salt);

            MemberUser user = new MemberUser();
            user.setId(SYSTEM_ID);
            user.setIsActive(true);
            AuthPassword pw = new AuthPassword();
            pw.setMemberUser(user);
            pw.setSalt(Base64.getEncoder().encodeToString(salt));
            pw.setPassword(passwordEncoder.encode(Base64.getEncoder().encodeToString(secret)));  // 아무도 모르는 값 → 로그인 불가
            MemberProfile profile = new MemberProfile();
            profile.setMemberUser(user);
            profile.setName(SYSTEM_NAME);
            user.setAuthPassword(pw);
            user.setMemberProfile(profile);
            memberUserRepository.save(user);
            logger.info("커뮤니티 시스템 계정 생성: {}", SYSTEM_ID);
        }
        int moved = postRepository.moveLegacyCategoriesToFree(ROOMS);
        if (moved > 0) logger.info("옛 카테고리 글 {}건을 '자유'로 옮김", moved);
    }
}
