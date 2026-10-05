package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.SavedAnalysis;
import com.agriforecast.backend.repository.SavedAnalysisRepository;
import org.junit.jupiter.api.Test;

import java.util.NoSuchElementException;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** 내 분석 저장 규칙. DB 없이 저장소를 흉내 낸다 */
class SavedAnalysisServiceTest {

    private final SavedAnalysisRepository repository = mock(SavedAnalysisRepository.class);
    private final SavedAnalysisService service = new SavedAnalysisService(repository);

    @Test
    void 저장하면_내_번호와_다듬은_값으로_남긴다() {
        when(repository.countByMemberId(7)).thenReturn(3L);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        SavedAnalysisService.View v = service.create(7, "  양파 도매→소매 ", "  ", "?s=retail:%EC%96%91%ED%8C%8C&f=s");
        assertEquals("양파 도매→소매", v.title());
        assertNull(v.memo());                                // 빈 메모는 null
        assertEquals("s=retail:%EC%96%91%ED%8C%8C&f=s", v.query());   // 앞의 ? 는 뗀다
        verify(repository).save(argThat(a -> a.getMemberId() == 7));
    }

    @Test
    void 쉰_개가_넘으면_더_저장하지_않는다() {
        when(repository.countByMemberId(7)).thenReturn((long) SavedAnalysisService.MAX_PER_MEMBER);
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> service.create(7, "이름", null, "s=a"));
        assertTrue(e.getMessage().contains("50개"));
        verify(repository, never()).save(any());
    }

    @Test
    void 이름_메모_주소를_검사한다() {
        assertThrows(IllegalArgumentException.class, () -> SavedAnalysisService.title(" "));
        assertThrows(IllegalArgumentException.class, () -> SavedAnalysisService.title("가".repeat(101)));
        assertThrows(IllegalArgumentException.class, () -> SavedAnalysisService.memo("가".repeat(501)));
        assertThrows(IllegalArgumentException.class, () -> SavedAnalysisService.query("f=s&p=1y"));      // 지표 없음
        assertThrows(IllegalArgumentException.class, () -> SavedAnalysisService.query("s=a b"));         // 공백
        assertThrows(IllegalArgumentException.class, () -> SavedAnalysisService.query("s=" + "a".repeat(2000)));
        assertEquals("f=s&s=a", SavedAnalysisService.query("f=s&s=a"));
    }

    @Test
    void 남의_분석은_고치거나_지울_수_없다() {
        when(repository.findByIdAndMemberId(5L, 8)).thenReturn(Optional.empty());
        assertThrows(NoSuchElementException.class, () -> service.update(8, 5L, "새 이름", null));
        assertThrows(NoSuchElementException.class, () -> service.delete(8, 5L));
        verify(repository, never()).delete(any());
    }

    @Test
    void 내_분석은_이름과_메모를_바꾼다() {
        SavedAnalysis a = new SavedAnalysis();
        a.setId(5L);
        a.setMemberId(7);
        a.setTitle("옛 이름");
        a.setQuery("s=a");
        when(repository.findByIdAndMemberId(5L, 7)).thenReturn(Optional.of(a));
        when(repository.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        SavedAnalysisService.View v = service.update(7, 5L, "새 이름", "메모");
        assertEquals("새 이름", v.title());
        assertEquals("메모", v.memo());
        assertEquals("s=a", v.query());
    }
}
