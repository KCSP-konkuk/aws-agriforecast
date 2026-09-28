package com.agriforecast.backend.util;

import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 순(10일 단위). 1~10일 상순 · 11~20일 중순 · 21일~말일 하순 — 예측 배치·소매가·커뮤니티 공통 규칙.
 * 코드는 예측 테이블 target_date 와 같은 "202610상순".
 */
public record Soon(int year, int month, int part) {

    private static final String[] NAMES = {"상순", "중순", "하순"};
    private static final Pattern CODE = Pattern.compile("^(\\d{4})(\\d{2})(상순|중순|하순)$");

    public Soon {
        if (month < 1 || month > 12 || part < 1 || part > 3) throw new IllegalArgumentException("잘못된 순");
    }

    public static Soon of(LocalDate d) {
        int day = d.getDayOfMonth();
        return new Soon(d.getYear(), d.getMonthValue(), day <= 10 ? 1 : day <= 20 ? 2 : 3);
    }

    public static Soon parse(String code) {
        Matcher m = CODE.matcher(code == null ? "" : code);
        if (!m.matches()) throw new IllegalArgumentException("순 코드 형식이 아님: " + code);
        int part = switch (m.group(3)) { case "상순" -> 1; case "중순" -> 2; default -> 3; };
        return new Soon(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), part);
    }

    public String code() {
        return String.format("%d%02d%s", year, month, NAMES[part - 1]);
    }

    public String label() {
        return month + "월 " + NAMES[part - 1];
    }

    public LocalDate start() {
        return LocalDate.of(year, month, part == 1 ? 1 : part == 2 ? 11 : 21);
    }

    public LocalDate end() {
        return part == 3 ? start().withDayOfMonth(start().lengthOfMonth()) : start().plusDays(9);
    }

    public Soon next() {
        return part < 3 ? new Soon(year, month, part + 1) : of(end().plusDays(1));
    }

    public Soon previous() {
        return of(start().minusDays(1));
    }

    public boolean contains(LocalDate d) {
        return !d.isBefore(start()) && !d.isAfter(end());
    }
}
