package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PostRequest {
    
    private String title;
    private String category;
    private String content;
    /** 붙일 분석 작업대 화면(주소의 쿼리). 비우면 붙이지 않는다 */
    private String analysisQuery;
}

