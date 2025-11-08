package com.mysky.api.dto.post;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostCreateRequest {
    
    @NotBlank(message = "Post content is required")
    private String content;
    
    private Long circleId;
    private String visibility;
    private List<String> tags;
    private Set<Long> mentions;
    private List<String> mediaUrls;
    private Double latitude;
    private Double longitude;
    private String location;
}
