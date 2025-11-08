package com.mysky.api.service;

import com.mysky.api.dto.post.PostCreateRequest;
import com.mysky.api.dto.post.PostDto;
import com.mysky.api.dto.post.PostUpdateRequest;
import com.mysky.api.entity.Circle;
import com.mysky.api.entity.Post;
import com.mysky.api.entity.User;
import com.mysky.api.repository.CircleRepository;
import com.mysky.api.repository.PostRepository;
import com.mysky.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PostService {

    private final PostRepository postRepository;
    private final UserRepository userRepository;
    private final CircleRepository circleRepository;

    @Transactional
    public PostDto createPost(PostCreateRequest request, Long authorId) {
        User author = userRepository.findById(authorId).orElseThrow();

        Post post = Post.builder()
                .content(request.getContent())
                .author(author)
                .visibility(request.getVisibility() != null ? 
                    Post.Visibility.valueOf(request.getVisibility()) : Post.Visibility.PUBLIC)
                .tags(request.getTags())
                .mentions(request.getMentions())
                .mediaUrls(request.getMediaUrls())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .location(request.getLocation())
                .build();

        if (request.getCircleId() != null) {
            Circle circle = circleRepository.findById(request.getCircleId()).orElseThrow();
            post.setCircle(circle);
        }

        post = postRepository.save(post);
        return convertToDto(post, authorId);
    }

    public PostDto getPostById(Long id, Long currentUserId) {
        Post post = postRepository.findById(id).orElseThrow();
        return convertToDto(post, currentUserId);
    }

    @Transactional
    public PostDto updatePost(Long id, PostUpdateRequest request) {
        Post post = postRepository.findById(id).orElseThrow();

        if (request.getContent() != null) post.setContent(request.getContent());
        if (request.getVisibility() != null) post.setVisibility(Post.Visibility.valueOf(request.getVisibility()));
        if (request.getTags() != null) post.setTags(request.getTags());
        if (request.getLatitude() != null) post.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) post.setLongitude(request.getLongitude());
        if (request.getLocation() != null) post.setLocation(request.getLocation());

        post = postRepository.save(post);
        return convertToDto(post, post.getAuthor().getId());
    }

    @Transactional
    public void deletePost(Long id) {
        postRepository.deleteById(id);
    }

    public Page<PostDto> getFeed(Long userId, int page, int size) {
        User user = userRepository.findById(userId).orElseThrow();
        List<Long> followingIds = user.getFollowing().stream()
                .map(User::getId)
                .collect(Collectors.toList());

        Pageable pageable = PageRequest.of(page, size);
        return postRepository.findFeed(userId, followingIds, pageable)
                .map(post -> convertToDto(post, userId));
    }

    public Page<PostDto> getPostsByUser(Long userId, Long currentUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return postRepository.findByAuthorId(userId, pageable)
                .map(post -> convertToDto(post, currentUserId));
    }

    public Page<PostDto> getPostsByCircle(Long circleId, Long currentUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return postRepository.findByCircleId(circleId, pageable)
                .map(post -> convertToDto(post, currentUserId));
    }

    public Page<PostDto> getPopularPosts(Long currentUserId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return postRepository.findPopularPosts(pageable)
                .map(post -> convertToDto(post, currentUserId));
    }

    public List<PostDto> getNearbyPosts(Double latitude, Double longitude, Double distance, Long currentUserId) {
        return postRepository.findNearbyPosts(latitude, longitude, distance).stream()
                .map(post -> convertToDto(post, currentUserId))
                .collect(Collectors.toList());
    }

    @Transactional
    public void likePost(Long postId, Long userId) {
        Post post = postRepository.findById(postId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        post.getLikedBy().add(user);
        postRepository.save(post);
    }

    @Transactional
    public void unlikePost(Long postId, Long userId) {
        Post post = postRepository.findById(postId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        post.getLikedBy().remove(user);
        postRepository.save(post);
    }

    private PostDto convertToDto(Post post, Long currentUserId) {
        boolean isLiked = post.getLikedBy().stream()
                .anyMatch(user -> user.getId().equals(currentUserId));

        return PostDto.builder()
                .id(post.getId())
                .content(post.getContent())
                .authorId(post.getAuthor().getId())
                .authorName(post.getAuthor().getDisplayName())
                .authorProfileImage(post.getAuthor().getProfileImageUrl())
                .circleId(post.getCircle() != null ? post.getCircle().getId() : null)
                .circleName(post.getCircle() != null ? post.getCircle().getName() : null)
                .visibility(post.getVisibility().toString())
                .tags(post.getTags())
                .mediaUrls(post.getMediaUrls())
                .latitude(post.getLatitude())
                .longitude(post.getLongitude())
                .location(post.getLocation())
                .likesCount(post.getLikedBy() != null ? post.getLikedBy().size() : 0)
                .commentsCount(post.getComments() != null ? post.getComments().size() : 0)
                .isLikedByCurrentUser(isLiked)
                .createdAt(post.getCreatedAt())
                .updatedAt(post.getUpdatedAt())
                .build();
    }
}
