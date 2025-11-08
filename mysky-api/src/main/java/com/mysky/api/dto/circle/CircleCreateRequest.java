package com.mysky.api.dto.circle;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CircleCreateRequest {
    
    @NotBlank(message = "Circle name is required")
    private String name;
    
    private String description;
    private String category;
    private String imageUrl;
    private Double latitude;
    private Double longitude;
    private String location;
    private String privacyLevel;
}
