package com.mysky.api.dto.event;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EventCreateRequest {
    
    @NotBlank(message = "Event title is required")
    private String title;
    
    private String description;
    private String category;
    private String imageUrl;
    
    @NotNull(message = "Start time is required")
    @Future(message = "Start time must be in the future")
    private LocalDateTime startTime;
    
    private LocalDateTime endTime;
    private Double latitude;
    private Double longitude;
    private String location;
    private String venue;
    private Long circleId;
    private Integer maxAttendees;
}
