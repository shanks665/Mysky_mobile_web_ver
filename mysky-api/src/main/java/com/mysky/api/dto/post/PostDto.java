package com.mysky.api.dto.post;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostDto {
    private Long id;
    private String content;
    private Long authorId;
    private String authorName;
    private String authorProfileImage;
    private Long circleId;
    private String circleName;
    private String visibility;
    private List<String> tags;
    private List<String> mediaUrls;
    private Double latitude;
    private Double longitude;
    private String location;
    private Integer likesCount;
    private Integer commentsCount;
    private Boolean isLikedByCurrentUser;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
