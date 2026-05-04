package com.agriforecast.backend.service;

import com.agriforecast.backend.dto.ItemCodeResponse;
import com.agriforecast.backend.dto.PriceDataResponse;
import com.agriforecast.backend.dto.PriceGraphResponse;
import com.agriforecast.backend.entity.ItemCode;
import com.agriforecast.backend.entity.RealItemPrice;
import com.agriforecast.backend.repository.ItemCodeRepository;
import com.agriforecast.backend.repository.RealItemPriceRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Transactional
public class PriceService {
    
    private static final Logger logger = LoggerFactory.getLogger(PriceService.class);
    
    @Autowired
    private ItemCodeRepository itemCodeRepository;
    
    @Autowired
    private RealItemPriceRepository realItemPriceRepository;
    
    // 모든 품목 목록 조회
    public List<ItemCodeResponse> getAllItemCodes() {
        List<ItemCode> items = itemCodeRepository.findAllByOrderByItemNameAsc();
        return items.stream()
                .map(item -> new ItemCodeResponse(
                        item.getSeqNoA021(),
                        item.getItemName(),
                        item.getCategory()
                ))
                .collect(Collectors.toList());
    }
    
    // 카테고리별 품목 목록 조회
    public List<ItemCodeResponse> getItemCodesByCategory(Integer category) {
        List<ItemCode> items = itemCodeRepository.findByCategory(category);
        return items.stream()
                .map(item -> new ItemCodeResponse(
                        item.getSeqNoA021(),
                        item.getItemName(),
                        item.getCategory()
                ))
                .collect(Collectors.toList());
    }
    
    // 특정 품목의 등급 목록 조회
    public List<String> getGradesByItemCode(Integer itemCode) {
        List<String> grades = realItemPriceRepository.findDistinctGradesByItemCode(itemCode);
        return grades;
    }
    
    // 1주일 가격 그래프 데이터 조회
    public PriceGraphResponse getPriceGraph(Integer itemCode, LocalDate endDate, String grade) {
        Optional<ItemCode> itemOpt = itemCodeRepository.findById(itemCode);
        if (itemOpt.isEmpty()) {
            throw new RuntimeException("품목을 찾을 수 없습니다.");
        }
        
        ItemCode item = itemOpt.get();
        LocalDate startDate = endDate.minusDays(6);  // 7일 데이터 (endDate 포함)
        
        // grade가 "전체"면 null로 변환 (모든 등급 조회)
        String gradeFilter = ("전체".equals(grade) || grade == null || grade.isEmpty()) ? null : grade;
        
        // 가격 데이터 조회
        List<RealItemPrice> prices = realItemPriceRepository.findByItemCodeAndDateRange(
                itemCode, startDate, endDate, gradeFilter
        );
        
        List<PriceDataResponse> priceDataList;
        
        if (gradeFilter == null) {
            // 전체 등급: 날짜별 평균 가격 계산
            priceDataList = calculateAveragePricesByDate(prices, startDate, endDate);
        } else {
            // 특정 등급: 해당 등급만 필터링
            priceDataList = prices.stream()
                    .map(p -> new PriceDataResponse(
                            p.getPriceDate(),
                            p.getPrice(),
                            p.getGrade()
                    ))
                    .collect(Collectors.toList());
            
            // 날짜별로 정렬
            priceDataList.sort(Comparator.comparing(PriceDataResponse::getDate));
        }
        
        PriceGraphResponse response = new PriceGraphResponse();
        response.setItemCode(item.getSeqNoA021());
        response.setItemName(item.getItemName());
        response.setCategory(item.getCategory());
        response.setGrade(gradeFilter == null ? "전체" : grade);
        response.setPriceData(priceDataList);
        
        logger.info("가격 그래프 데이터 조회 완료 - 품목: {}, 기간: {} ~ {}, 등급: {}, 데이터 수: {}",
                item.getItemName(), startDate, endDate, grade, priceDataList.size());
        
        return response;
    }
    
    // 날짜별 평균 가격 계산 (전체 등급용)
    private List<PriceDataResponse> calculateAveragePricesByDate(
            List<RealItemPrice> prices, LocalDate startDate, LocalDate endDate) {
        
        // 날짜별로 그룹화
        Map<LocalDate, List<RealItemPrice>> pricesByDate = prices.stream()
                .collect(Collectors.groupingBy(RealItemPrice::getPriceDate));
        
        List<PriceDataResponse> result = new ArrayList<>();
        LocalDate currentDate = startDate;
        
        while (!currentDate.isAfter(endDate)) {
            List<RealItemPrice> dayPrices = pricesByDate.get(currentDate);
            
            if (dayPrices != null && !dayPrices.isEmpty()) {
                // 해당 날짜의 평균 가격 계산
                double averagePrice = dayPrices.stream()
                        .mapToInt(RealItemPrice::getPrice)
                        .average()
                        .orElse(0.0);
                
                result.add(new PriceDataResponse(
                        currentDate,
                        (int) Math.round(averagePrice),
                        "전체"
                ));
            } else {
                // 데이터가 없는 날짜는 null 또는 0으로 처리
                result.add(new PriceDataResponse(
                        currentDate,
                        null,
                        "전체"
                ));
            }
            
            currentDate = currentDate.plusDays(1);
        }
        
        return result;
    }
}

