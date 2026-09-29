package com.agriforecast.backend.service;

import com.agriforecast.backend.service.CommunityVoteService.Choice;
import com.agriforecast.backend.util.Soon;
import com.agriforecast.backend.entity.MemberProfile;
import com.agriforecast.backend.entity.MemberUser;
import com.agriforecast.backend.repository.MemberUserRepository;
import com.agriforecast.backend.repository.PostRepository;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import static org.junit.jupiter.api.Assertions.*;

/** 순 첫날 자동 시세 브리핑 문장. 외부 의존 없음 */
class MarketBriefServiceTest {

    private static final Soon NOW = Soon.parse("202610상순");

    @Test
    void 제목() {
        assertEquals("10월 상순 배추 시세 브리핑", MarketBriefService.title(NOW, "배추"));
    }

    @Test
    void 값이_다_있으면_세_문장() {
        java.util.Map<Choice, Long> votes = new java.util.EnumMap<>(Choice.class);
        votes.put(Choice.UP, 3L); votes.put(Choice.SAME, 1L); votes.put(Choice.DOWN, 0L);
        CommunityVoteService.Last last = CommunityVoteService.judge("202609하순", 13986.0, 13210.0, 13939.0, votes);
        String body = MarketBriefService.body(NOW, "배추", "10키로망대", 13986.0, 13210.0, 13900.0, last);
        assertEquals(String.join("\n",
                "지난 순(9월 하순) 가락시장 배추 경매가는 평균 13,210원(상, 10키로망대)으로 그 전 순보다 5.5% 내렸습니다.",
                "AI 는 이번 순(10월 상순) 평균을 13,900원으로 예측합니다. 지난 순보다 5.2% 높은 값입니다.",
                "지난 순 투표: 참여자 다수 '오른다' · AI '비슷' · 실제 '내린다'."), body);
    }

    @Test
    void 투표가_없으면_참여자_없음() {
        java.util.Map<Choice, Long> votes = new java.util.EnumMap<>(Choice.class);
        CommunityVoteService.Last last = CommunityVoteService.judge("202609하순", 13986.0, 13210.0, 13939.0, votes);
        String body = MarketBriefService.body(NOW, "배추", "10키로망대", 13986.0, 13210.0, 13900.0, last);
        assertTrue(body.endsWith("지난 순 투표: 참여자 없음 · AI '비슷' · 실제 '내린다'."), body);
    }

    @Test
    void 동률이면_맞선_선택지와_동률() {
        java.util.Map<Choice, Long> votes = new java.util.EnumMap<>(Choice.class);
        votes.put(Choice.UP, 2L); votes.put(Choice.DOWN, 2L);
        CommunityVoteService.Last last = CommunityVoteService.judge("202609하순", 13986.0, 13210.0, 13939.0, votes);
        String body = MarketBriefService.body(NOW, "배추", "10키로망대", 13986.0, 13210.0, 13900.0, last);
        assertTrue(body.endsWith("지난 순 투표: 참여자 '오른다'·'내린다' 동률 · AI '비슷' · 실제 '내린다'."), body);
    }

    @Test
    void 없는_값의_문장은_뺀다() {
        String body = MarketBriefService.body(NOW, "양파", "1키로", null, 1140.0, null, null);
        assertEquals("지난 순(9월 하순) 가락시장 양파 경매가는 평균 1,140원(상, 1키로)입니다.", body);
    }

    private static MemberUser account(String name, String email) {
        MemberUser u = new MemberUser();
        u.setId("agriforecast");
        MemberProfile p = new MemberProfile();
        p.setName(name);
        p.setEmail(email);
        u.setMemberProfile(p);
        return u;
    }

    private static MarketBriefService service(PostRepository posts, MemberUser author) {
        MemberUserRepository members = mock(MemberUserRepository.class);
        when(members.findByUserId("agriforecast")).thenReturn(Optional.ofNullable(author));
        CommunityVoteService votes = mock(CommunityVoteService.class);
        when(votes.soonAverage(any(), any())).thenReturn(1000.0);
        PredictionService prediction = mock(PredictionService.class);
        when(prediction.predictedPrice(any(), any())).thenReturn(Optional.empty());
        return new MarketBriefService(posts, members, votes, prediction);
    }

    @Test
    void 같은_순_브리핑_판별은_제목이_아니라_그_순_기간의_BRIEF_글로_한다() {
        PostRepository posts = mock(PostRepository.class);
        // 2027-10-01 에 배추 브리핑만 이미 있다 → 제목이 2026 년과 같아도 양파·홍고추는 새로 쓴다
        when(posts.existsByCategoryAndKindAndCreatedAtBetween(eq("배추"), eq("BRIEF"),
                eq(LocalDateTime.of(2027, 10, 1, 0, 0)), eq(LocalDateTime.of(2027, 10, 11, 0, 0)))).thenReturn(true);
        int written = service(posts, account("AgriForecast", null)).publish(LocalDate.of(2027, 10, 1));
        assertEquals(2, written);
        verify(posts, times(2)).save(any());
    }

    @Test
    void 시스템_계정이_아닌_같은_아이디_회원이면_쓰지_않는다() {
        PostRepository posts = mock(PostRepository.class);
        int written = service(posts, account("김농부", "kim@example.com")).publish(LocalDate.of(2027, 10, 1));
        assertEquals(0, written);
        verify(posts, never()).save(any());
    }
}
