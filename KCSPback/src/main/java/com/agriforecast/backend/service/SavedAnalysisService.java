package com.agriforecast.backend.service;

import com.agriforecast.backend.entity.SavedAnalysis;
import com.agriforecast.backend.repository.SavedAnalysisRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.NoSuchElementException;

/**
 * 내 분석 — 로그인 사용자가 작업대 화면(주소의 쿼리)을 이름·메모와 함께 저장했다가 다시 연다.
 * 남의 분석은 없는 것처럼 다룬다(404). 한 사람이 50개까지
 */
@Service
public class SavedAnalysisService {

    public static final int MAX_PER_MEMBER = 50;
    static final int MAX_TITLE = 100;
    static final int MAX_MEMO = 500;
    static final int MAX_QUERY = 2000;

    public record View(Long id, String title, String memo, String query, LocalDateTime updatedAt) {
        static View of(SavedAnalysis a) {
            return new View(a.getId(), a.getTitle(), a.getMemo(), a.getQuery(), a.getUpdatedAt());
        }
    }

    private final SavedAnalysisRepository repository;

    public SavedAnalysisService(SavedAnalysisRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<View> list(Integer memberId) {
        return repository.findByMemberIdOrderByUpdatedAtDesc(memberId).stream().map(View::of).toList();
    }

    @Transactional
    public View create(Integer memberId, String title, String memo, String query) {
        if (repository.countByMemberId(memberId) >= MAX_PER_MEMBER) {
            throw new IllegalArgumentException("분석은 " + MAX_PER_MEMBER + "개까지 저장할 수 있어요. 안 쓰는 분석을 지워 주세요.");
        }
        SavedAnalysis a = new SavedAnalysis();
        a.setMemberId(memberId);
        a.setTitle(title(title));
        a.setMemo(memo(memo));
        a.setQuery(query(query));
        return View.of(repository.save(a));
    }

    @Transactional
    public View update(Integer memberId, Long id, String title, String memo) {
        SavedAnalysis a = own(memberId, id);
        a.setTitle(title(title));
        a.setMemo(memo(memo));
        return View.of(repository.saveAndFlush(a));
    }

    @Transactional
    public void delete(Integer memberId, Long id) {
        repository.delete(own(memberId, id));
    }

    private SavedAnalysis own(Integer memberId, Long id) {
        return repository.findByIdAndMemberId(id, memberId).orElseThrow(() -> new NoSuchElementException("분석을 찾을 수 없어요."));
    }

    static String title(String raw) {
        String t = raw == null ? "" : raw.strip();
        if (t.isEmpty()) throw new IllegalArgumentException("분석 이름을 적어 주세요.");
        if (t.length() > MAX_TITLE) throw new IllegalArgumentException("분석 이름은 " + MAX_TITLE + "자까지예요.");
        return t;
    }

    static String memo(String raw) {
        String m = raw == null ? "" : raw.strip();
        if (m.length() > MAX_MEMO) throw new IllegalArgumentException("메모는 " + MAX_MEMO + "자까지예요.");
        return m.isEmpty() ? null : m;
    }

    /** 작업대 쿼리: 앞의 ? 는 떼고, 지표(s=)가 있어야 하고, 공백·줄바꿈은 없다 */
    static String query(String raw) {
        String q = raw == null ? "" : raw.strip();
        if (q.startsWith("?")) q = q.substring(1);
        if (q.isEmpty() || q.length() > MAX_QUERY || q.chars().anyMatch(Character::isWhitespace)
                || !("&" + q).contains("&s=")) {
            throw new IllegalArgumentException("작업대 화면 주소가 올바르지 않아요.");
        }
        return q;
    }
}
