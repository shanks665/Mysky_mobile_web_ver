package com.mysky.api.controller;

import com.mysky.api.dto.common.ApiResponse;
import com.mysky.api.dto.user.UserDto;
import com.mysky.api.dto.user.UserUpdateRequest;
import com.mysky.api.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<UserDto>> getCurrentUser(Authentication authentication) {
        String username = authentication.getName();
        // In real implementation, you'd get user by username
        return ResponseEntity.ok(ApiResponse.success("User retrieved", null));
    }

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserDto>> getUserById(@PathVariable Long userId) {
        UserDto user = userService.getUserById(userId);
        return ResponseEntity.ok(ApiResponse.success(user));
    }

    @PutMapping("/{userId}")
    public ResponseEntity<ApiResponse<UserDto>> updateUser(
            @PathVariable Long userId,
            @RequestBody UserUpdateRequest request,
            Authentication authentication) {
        UserDto user = userService.updateUser(userId, request);
        return ResponseEntity.ok(ApiResponse.success("User updated", user));
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<ApiResponse<Void>> deleteUser(
            @PathVariable Long userId,
            Authentication authentication) {
        userService.deleteUser(userId);
        return ResponseEntity.ok(ApiResponse.success("User deleted", null));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<UserDto>>> searchUsers(@RequestParam String query) {
        List<UserDto> users = userService.searchUsers(query);
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<UserDto>>> getNearbyUsers(
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam(defaultValue = "10.0") Double radius) {
        List<UserDto> users = userService.getNearbyUsers(latitude, longitude, radius);
        return ResponseEntity.ok(ApiResponse.success(users));
    }

    @PostMapping("/{userId}/follow")
    public ResponseEntity<ApiResponse<Void>> followUser(
            @PathVariable Long userId,
            Authentication authentication) {
        // Get current user ID from authentication
        Long currentUserId = 1L; // Placeholder
        userService.followUser(currentUserId, userId);
        return ResponseEntity.ok(ApiResponse.success("User followed", null));
    }

    @DeleteMapping("/{userId}/follow")
    public ResponseEntity<ApiResponse<Void>> unfollowUser(
            @PathVariable Long userId,
            Authentication authentication) {
        Long currentUserId = 1L; // Placeholder
        userService.unfollowUser(currentUserId, userId);
        return ResponseEntity.ok(ApiResponse.success("User unfollowed", null));
    }

    @GetMapping("/{userId}/followers")
    public ResponseEntity<ApiResponse<List<UserDto>>> getFollowers(@PathVariable Long userId) {
        List<UserDto> followers = userService.getFollowers(userId);
        return ResponseEntity.ok(ApiResponse.success(followers));
    }

    @GetMapping("/{userId}/following")
    public ResponseEntity<ApiResponse<List<UserDto>>> getFollowing(@PathVariable Long userId) {
        List<UserDto> following = userService.getFollowing(userId);
        return ResponseEntity.ok(ApiResponse.success(following));
    }
}
