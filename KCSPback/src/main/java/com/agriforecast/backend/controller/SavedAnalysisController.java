package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.SavedAnalysisService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;

/** 내 분석(작업대 저장). /api/me/** 라 SecurityConfig 에서 로그인을 요구한다 */
@RestController
@RequestMapping("/api/me/analyses")
public class SavedAnalysisController {

    private final SavedAnalysisService service;

    public SavedAnalysisController(SavedAnalysisService service) {
        this.service = service;
    }

    @GetMapping
    public List<SavedAnalysisService.View> list(@AuthenticationPrincipal Integer userId) {
        return service.list(userId);
    }

    @PostMapping
    public ResponseEntity<SavedAnalysisService.View> create(@RequestBody Map<String, String> body, @AuthenticationPrincipal Integer userId) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.create(userId, body.get("title"), body.get("memo"), body.get("query")));
    }

    @PutMapping("/{id}")
    public SavedAnalysisService.View update(@PathVariable Long id, @RequestBody Map<String, String> body,
                                            @AuthenticationPrincipal Integer userId) {
        return service.update(userId, id, body.get("title"), body.get("memo"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, @AuthenticationPrincipal Integer userId) {
        service.delete(userId, id);
        return ResponseEntity.noContent().build();
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException e) {
        return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(NoSuchElementException.class)
    public ResponseEntity<Map<String, String>> notFound(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }
}
