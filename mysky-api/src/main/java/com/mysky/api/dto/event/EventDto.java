package com.mysky.api.dto.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventDto {
    private Long id;
    private String title;
    private String description;
    private String category;
    private String imageUrl;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Double latitude;
    private Double longitude;
    private String location;
    private String venue;
    private Long creatorId;
    private String creatorName;
    private Long circleId;
    private String circleName;
    private String status;
    private Integer attendeesCount;
    private Integer maxAttendees;
    private LocalDateTime createdAt;
}
