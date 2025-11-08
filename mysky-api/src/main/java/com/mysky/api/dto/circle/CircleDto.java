package com.mysky.api.dto.circle;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CircleDto {
    private Long id;
    private String name;
    private String description;
    private String category;
    private String imageUrl;
    private Double latitude;
    private Double longitude;
    private String location;
    private Long creatorId;
    private String creatorName;
    private String privacyLevel;
    private Integer membersCount;
    private LocalDateTime createdAt;
}
