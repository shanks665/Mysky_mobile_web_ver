package com.mysky.api.dto.post;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PostUpdateRequest {
    private String content;
    private String visibility;
    private List<String> tags;
    private Double latitude;
    private Double longitude;
    private String location;
}
