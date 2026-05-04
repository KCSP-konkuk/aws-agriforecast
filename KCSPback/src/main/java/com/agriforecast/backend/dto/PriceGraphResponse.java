package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PriceGraphResponse {
    private Integer itemCode;
    private String itemName;
    private Integer category;
    private String grade;  // "전체" 또는 특정 등급
    private List<PriceDataResponse> priceData;
}

