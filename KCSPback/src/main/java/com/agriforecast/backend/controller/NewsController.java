package com.agriforecast.backend.controller;

import com.agriforecast.backend.dto.NaverNewsItem;
import com.agriforecast.backend.service.NaverNewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/news")
@CrossOrigin(origins = "http://localhost:5173")
public class NewsController {

    @Autowired
    private NaverNewsService naverNewsService;

    @GetMapping("/agri")
    public ResponseEntity<List<NaverNewsItem>> getAgriNews() {
        try {
            List<NaverNewsItem> news = naverNewsService.getAgriNews();
            return ResponseEntity.ok(news);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}
