package com.agriforecast.backend.config;

import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.*;

/** 커뮤니티 기동 준비. 외부 의존 없음 */
class CommunitySetupTest {

    @Test
    void 옛_카테고리_이관은_방_목록_상수를_넘겨_그_밖의_글만_옮긴다() {
        MemberUserRepository members = mock(MemberUserRepository.class);
        when(members.findByUserId(CommunitySetup.SYSTEM_ID)).thenReturn(Optional.of(new MemberUser()));
        PostRepository posts = mock(PostRepository.class);
        new CommunitySetup(members, posts, mock(PasswordEncoder.class)).prepare();
        verify(posts).moveLegacyCategoriesToFree(List.of("배추", "양파", "홍고추", "자유"));
    }
}
