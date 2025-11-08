package com.mysky.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserUpdateRequest {
    private String displayName;
    private String bio;
    private String profileImageUrl;
    private Double latitude;
    private Double longitude;
    private String location;
    private String privacyLevel;
}
