package com.mysky.api.dto.user;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSearchRequest {
    private String query;
    private Double latitude;
    private Double longitude;
    private Double radius;
}
