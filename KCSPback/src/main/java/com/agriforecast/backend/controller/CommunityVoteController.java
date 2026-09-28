package com.agriforecast.backend.controller;

import com.agriforecast.backend.service.CommunityVoteService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/** 커뮤니티 품목방 '다음 순 오를까' 투표. POST 는 SecurityConfig 의 /api/community/** 규칙으로 로그인 필요 */
@RestController
@RequestMapping("/api/community/votes")
public class CommunityVoteController {

    private final CommunityVoteService voteService;

    public CommunityVoteController(CommunityVoteService voteService) {
        this.voteService = voteService;
    }

    @GetMapping("/{itemName}")
    public ResponseEntity<?> status(@PathVariable String itemName, @AuthenticationPrincipal Integer userId) {
        try {
            return ResponseEntity.ok(voteService.status(itemName, userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/{itemName}")
    public ResponseEntity<?> vote(@PathVariable String itemName, @RequestBody Map<String, String> body,
                                  @AuthenticationPrincipal Integer userId) {
        try {
            return ResponseEntity.ok(voteService.vote(itemName, body.get("choice"), userId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
