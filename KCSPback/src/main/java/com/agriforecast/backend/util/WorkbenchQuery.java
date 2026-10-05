package com.agriforecast.backend.util;

/** 분석 작업대 화면 주소의 쿼리(s=…&t=…&f=…) 검사 — 내 분석 저장 · 커뮤니티 글 붙이기가 같이 쓴다 */
public final class WorkbenchQuery {

    public static final int MAX = 2000;

    private WorkbenchQuery() {
    }

    /** 앞의 ? 는 떼고, 지표(s=)가 있어야 하고, 공백·줄바꿈이 없고 2000자까지. 틀리면 IllegalArgumentException */
    public static String normalize(String raw) {
        String q = raw == null ? "" : raw.strip();
        if (q.startsWith("?")) q = q.substring(1);
        if (q.isEmpty() || q.length() > MAX || q.chars().anyMatch(Character::isWhitespace) || !("&" + q).contains("&s=")) {
            throw new IllegalArgumentException("작업대 화면 주소가 올바르지 않아요.");
        }
        return q;
    }

    /** 비어 있으면 null(붙이지 않음), 아니면 normalize */
    public static String optional(String raw) {
        return raw == null || raw.isBlank() ? null : normalize(raw);
    }
}
