package com.agriforecast.backend.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class NaverDataLabResponse {

    private String startDate;
    private String endDate;
    private String timeUnit;
    private List<Result> results;

    @Getter
    @Setter
    public static class Result {
        private String title;
        private List<String> keywords;
        private List<DataPoint> data;
    }

    @Getter
    @Setter
    public static class DataPoint {
        private String period;
        private Double ratio;
    }
}