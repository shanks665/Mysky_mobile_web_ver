package com.mysky.api.dto.auth;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthResponse {
    private String token;
    private String refreshToken;
    private String type;
    private Long userId;
    private String username;
    private String email;
    
    @Builder.Default
    private String tokenType = "Bearer";
}
