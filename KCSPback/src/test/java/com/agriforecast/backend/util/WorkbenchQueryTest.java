package com.agriforecast.backend.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** 작업대 주소 쿼리 검사 — 내 분석 · 커뮤니티 글 붙이기 공통 */
class WorkbenchQueryTest {

    @Test
    void 앞의_물음표는_떼고_지표가_있어야_한다() {
        assertEquals("s=retail:a&f=s", WorkbenchQuery.normalize("?s=retail:a&f=s"));
        assertEquals("f=s&s=a", WorkbenchQuery.normalize(" f=s&s=a "));
        assertThrows(IllegalArgumentException.class, () -> WorkbenchQuery.normalize("f=s&ss=a"));   // s= 가 아니라 ss=
        assertThrows(IllegalArgumentException.class, () -> WorkbenchQuery.normalize("s=a\nb"));
        assertThrows(IllegalArgumentException.class, () -> WorkbenchQuery.normalize("s=" + "a".repeat(WorkbenchQuery.MAX)));
    }

    @Test
    void 비어_있으면_붙이지_않는다() {
        assertNull(WorkbenchQuery.optional(null));
        assertNull(WorkbenchQuery.optional("   "));
        assertEquals("s=a", WorkbenchQuery.optional("s=a"));
        assertThrows(IllegalArgumentException.class, () -> WorkbenchQuery.optional("아무 글"));
    }
}
