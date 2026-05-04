package com.agriforecast.backend.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ItemCodeResponse {
    private Integer itemCode;  // SEQ_NO_A021
    private String itemName;
    private Integer category;
}

