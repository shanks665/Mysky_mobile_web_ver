package com.mysky.api.controller;

import com.mysky.api.dto.circle.CircleCreateRequest;
import com.mysky.api.dto.circle.CircleDto;
import com.mysky.api.dto.circle.CircleUpdateRequest;
import com.mysky.api.dto.common.ApiResponse;
import com.mysky.api.service.CircleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/circles")
@RequiredArgsConstructor
public class CircleController {

    private final CircleService circleService;

    @PostMapping
    public ResponseEntity<ApiResponse<CircleDto>> createCircle(
            @Valid @RequestBody CircleCreateRequest request,
            Authentication authentication) {
        Long creatorId = 1L; // Get from authentication
        CircleDto circle = circleService.createCircle(request, creatorId);
        return ResponseEntity.ok(ApiResponse.success("Circle created", circle));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<CircleDto>>> getAllCircles() {
        List<CircleDto> circles = circleService.getAllCircles();
        return ResponseEntity.ok(ApiResponse.success(circles));
    }

    @GetMapping("/{circleId}")
    public ResponseEntity<ApiResponse<CircleDto>> getCircleById(@PathVariable Long circleId) {
        CircleDto circle = circleService.getCircleById(circleId);
        return ResponseEntity.ok(ApiResponse.success(circle));
    }

    @PutMapping("/{circleId}")
    public ResponseEntity<ApiResponse<CircleDto>> updateCircle(
            @PathVariable Long circleId,
            @RequestBody CircleUpdateRequest request) {
        CircleDto circle = circleService.updateCircle(circleId, request);
        return ResponseEntity.ok(ApiResponse.success("Circle updated", circle));
    }

    @DeleteMapping("/{circleId}")
    public ResponseEntity<ApiResponse<Void>> deleteCircle(@PathVariable Long circleId) {
        circleService.deleteCircle(circleId);
        return ResponseEntity.ok(ApiResponse.success("Circle deleted", null));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<CircleDto>>> searchCircles(@RequestParam String query) {
        List<CircleDto> circles = circleService.searchCircles(query);
        return ResponseEntity.ok(ApiResponse.success(circles));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<CircleDto>>> getNearbyCircles(
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam(defaultValue = "10.0") Double radius) {
        List<CircleDto> circles = circleService.getNearbyCircles(latitude, longitude, radius);
        return ResponseEntity.ok(ApiResponse.success(circles));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<ApiResponse<List<CircleDto>>> getCirclesByCategory(@PathVariable String category) {
        List<CircleDto> circles = circleService.getCirclesByCategory(category);
        return ResponseEntity.ok(ApiResponse.success(circles));
    }

    @GetMapping("/my-circles")
    public ResponseEntity<ApiResponse<List<CircleDto>>> getMyCircles(Authentication authentication) {
        Long userId = 1L; // Get from authentication
        List<CircleDto> circles = circleService.getMyCircles(userId);
        return ResponseEntity.ok(ApiResponse.success(circles));
    }

    @PostMapping("/{circleId}/join")
    public ResponseEntity<ApiResponse<Void>> joinCircle(
            @PathVariable Long circleId,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        circleService.joinCircle(circleId, userId);
        return ResponseEntity.ok(ApiResponse.success("Joined circle", null));
    }

    @DeleteMapping("/{circleId}/leave")
    public ResponseEntity<ApiResponse<Void>> leaveCircle(
            @PathVariable Long circleId,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        circleService.leaveCircle(circleId, userId);
        return ResponseEntity.ok(ApiResponse.success("Left circle", null));
    }
}
