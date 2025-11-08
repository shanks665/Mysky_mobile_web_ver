package com.mysky.api.controller;

import com.mysky.api.dto.common.ApiResponse;
import com.mysky.api.dto.post.PostCreateRequest;
import com.mysky.api.dto.post.PostDto;
import com.mysky.api.dto.post.PostUpdateRequest;
import com.mysky.api.service.PostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/posts")
@RequiredArgsConstructor
public class PostController {

    private final PostService postService;

    @PostMapping
    public ResponseEntity<ApiResponse<PostDto>> createPost(
            @Valid @RequestBody PostCreateRequest request,
            Authentication authentication) {
        Long authorId = 1L; // Get from authentication
        PostDto post = postService.createPost(request, authorId);
        return ResponseEntity.ok(ApiResponse.success("Post created", post));
    }

    @GetMapping("/{postId}")
    public ResponseEntity<ApiResponse<PostDto>> getPostById(
            @PathVariable Long postId,
            Authentication authentication) {
        Long currentUserId = 1L; // Get from authentication
        PostDto post = postService.getPostById(postId, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(post));
    }

    @PutMapping("/{postId}")
    public ResponseEntity<ApiResponse<PostDto>> updatePost(
            @PathVariable Long postId,
            @RequestBody PostUpdateRequest request) {
        PostDto post = postService.updatePost(postId, request);
        return ResponseEntity.ok(ApiResponse.success("Post updated", post));
    }

    @DeleteMapping("/{postId}")
    public ResponseEntity<ApiResponse<Void>> deletePost(@PathVariable Long postId) {
        postService.deletePost(postId);
        return ResponseEntity.ok(ApiResponse.success("Post deleted", null));
    }

    @GetMapping("/feed")
    public ResponseEntity<ApiResponse<Page<PostDto>>> getFeed(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        Page<PostDto> posts = postService.getFeed(userId, page, size);
        return ResponseEntity.ok(ApiResponse.success(posts));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<ApiResponse<Page<PostDto>>> getPostsByUser(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        Long currentUserId = 1L; // Get from authentication
        Page<PostDto> posts = postService.getPostsByUser(userId, currentUserId, page, size);
        return ResponseEntity.ok(ApiResponse.success(posts));
    }

    @GetMapping("/circle/{circleId}")
    public ResponseEntity<ApiResponse<Page<PostDto>>> getPostsByCircle(
            @PathVariable Long circleId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        Long currentUserId = 1L; // Get from authentication
        Page<PostDto> posts = postService.getPostsByCircle(circleId, currentUserId, page, size);
        return ResponseEntity.ok(ApiResponse.success(posts));
    }

    @GetMapping("/popular")
    public ResponseEntity<ApiResponse<Page<PostDto>>> getPopularPosts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            Authentication authentication) {
        Long currentUserId = 1L; // Get from authentication
        Page<PostDto> posts = postService.getPopularPosts(currentUserId, page, size);
        return ResponseEntity.ok(ApiResponse.success(posts));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<PostDto>>> getNearbyPosts(
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam(defaultValue = "10.0") Double radius,
            Authentication authentication) {
        Long currentUserId = 1L; // Get from authentication
        List<PostDto> posts = postService.getNearbyPosts(latitude, longitude, radius, currentUserId);
        return ResponseEntity.ok(ApiResponse.success(posts));
    }

    @PostMapping("/{postId}/like")
    public ResponseEntity<ApiResponse<Void>> likePost(
            @PathVariable Long postId,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        postService.likePost(postId, userId);
        return ResponseEntity.ok(ApiResponse.success("Post liked", null));
    }

    @DeleteMapping("/{postId}/like")
    public ResponseEntity<ApiResponse<Void>> unlikePost(
            @PathVariable Long postId,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        postService.unlikePost(postId, userId);
        return ResponseEntity.ok(ApiResponse.success("Post unliked", null));
    }
}
