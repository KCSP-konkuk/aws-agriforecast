package com.agriforecast.backend.controller;

import com.agriforecast.backend.dto.ItemCodeResponse;
import com.agriforecast.backend.dto.KamisDailyPriceResponse;
import com.agriforecast.backend.dto.PriceGraphResponse;
import com.agriforecast.backend.entity.AgriPrice;
import com.agriforecast.backend.repository.AgriPriceRepository;
import com.agriforecast.backend.service.KamisService;
import com.agriforecast.backend.service.PriceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/price")
@CrossOrigin(origins = "http://localhost:5173")
public class PriceController {

    @Autowired
    private PriceService priceService;

    @Autowired
    private KamisService kamisService;

    @Autowired
    private AgriPriceRepository agriPriceRepository;
    
    // KAMIS 주요 농산물 일일 가격 조회 (쌀·콩·고구마·감자·배추·양배추·상추)
    @GetMapping("/daily")
    public ResponseEntity<List<KamisDailyPriceResponse>> getDailyPrices() {
        try {
            List<KamisDailyPriceResponse> prices = kamisService.getDailyPrices();
            return ResponseEntity.ok(prices);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 모든 품목 목록 조회
    @GetMapping("/items")
    public ResponseEntity<List<ItemCodeResponse>> getAllItems() {
        try {
            List<ItemCodeResponse> items = priceService.getAllItemCodes();
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 카테고리별 품목 목록 조회
    @GetMapping("/items/category/{category}")
    public ResponseEntity<List<ItemCodeResponse>> getItemsByCategory(@PathVariable Integer category) {
        try {
            List<ItemCodeResponse> items = priceService.getItemCodesByCategory(category);
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // 특정 품목의 등급 목록 조회
    @GetMapping("/items/{itemCode}/grades")
    public ResponseEntity<List<String>> getGradesByItemCode(@PathVariable Integer itemCode) {
        try {
            List<String> grades = priceService.getGradesByItemCode(itemCode);
            return ResponseEntity.ok(grades);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
    
    // agri_price 테이블의 품목명 목록 조회 (배추·양파·양배추·당근)
    @GetMapping("/agri/items")
    public ResponseEntity<List<String>> getAgriItems() {
        try {
            List<String> items = agriPriceRepository.findDistinctItemNames();
            return ResponseEntity.ok(items);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // agri_price 테이블 기반 가격 그래프 데이터 조회
    @GetMapping("/agri/graph")
    public ResponseEntity<Map<String, Object>> getAgriPriceGraph(
            @RequestParam String itemName,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate) {
        try {
            int startKey = startDate.getYear() * 10000 + startDate.getMonthValue() * 100 + startDate.getDayOfMonth();
            int endKey   = endDate.getYear()   * 10000 + endDate.getMonthValue()   * 100 + endDate.getDayOfMonth();

            List<AgriPrice> prices = agriPriceRepository.findByItemNameAndDateRange(itemName, startKey, endKey);

            List<Map<String, Object>> priceData = prices.stream()
                    .filter(p -> p.getAvgPrice() != null)
                    .map(p -> {
                        Map<String, Object> entry = new LinkedHashMap<>();
                        entry.put("date", String.format("%d-%02d-%02d", p.getYear(), p.getMonth(), p.getDay()));
                        entry.put("price", p.getAvgPrice().intValue());
                        entry.put("grade", "상");
                        return entry;
                    })
                    .collect(Collectors.toList());

            Map<String, Object> result = new LinkedHashMap<>();
            result.put("itemName", itemName);
            result.put("priceData", priceData);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // 가격 그래프 데이터 조회
    @GetMapping("/graph")
    public ResponseEntity<PriceGraphResponse> getPriceGraph(
            @RequestParam Integer itemCode,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false, defaultValue = "전체") String grade) {
        try {
            PriceGraphResponse response = priceService.getPriceGraph(itemCode, startDate, endDate, grade);
            return ResponseEntity.ok(response);
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}

