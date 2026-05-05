package com.agriforecast.backend.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class KamisDailyPriceResponse {
    private String itemName;
    private String unit;
    private String price;
    private String direction;   // "0"=하락, "1"=상승, "2"=등락없음
    private String changeRate;
    private String lastDate;
}
