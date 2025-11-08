package com.mysky.api.service;

import com.mysky.api.dto.user.UserDto;
import com.mysky.api.dto.user.UserUpdateRequest;
import com.mysky.api.entity.User;
import com.mysky.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public UserDto getUserById(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return convertToDto(user);
    }

    @Transactional
    public UserDto updateUser(Long id, UserUpdateRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        if (request.getDisplayName() != null) user.setDisplayName(request.getDisplayName());
        if (request.getBio() != null) user.setBio(request.getBio());
        if (request.getProfileImageUrl() != null) user.setProfileImageUrl(request.getProfileImageUrl());
        if (request.getLatitude() != null) user.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) user.setLongitude(request.getLongitude());
        if (request.getLocation() != null) user.setLocation(request.getLocation());

        user = userRepository.save(user);
        return convertToDto(user);
    }

    public List<UserDto> searchUsers(String query) {
        return userRepository.findByUsernameContainingIgnoreCase(query)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<UserDto> getNearbyUsers(Double latitude, Double longitude, Double distance) {
        return userRepository.findNearbyUsers(latitude, longitude, distance)
                .stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void followUser(Long userId, Long targetUserId) {
        User user = userRepository.findById(userId).orElseThrow();
        User targetUser = userRepository.findById(targetUserId).orElseThrow();
        user.getFollowing().add(targetUser);
        userRepository.save(user);
    }

    @Transactional
    public void unfollowUser(Long userId, Long targetUserId) {
        User user = userRepository.findById(userId).orElseThrow();
        User targetUser = userRepository.findById(targetUserId).orElseThrow();
        user.getFollowing().remove(targetUser);
        userRepository.save(user);
    }

    @Transactional
    public void deleteUser(Long id) {
        userRepository.deleteById(id);
    }

    public List<UserDto> getFollowers(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return user.getFollowers().stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<UserDto> getFollowing(Long userId) {
        User user = userRepository.findById(userId).orElseThrow();
        return user.getFollowing().stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    private UserDto convertToDto(User user) {
        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .bio(user.getBio())
                .profileImageUrl(user.getProfileImageUrl())
                .dateOfBirth(user.getDateOfBirth())
                .latitude(user.getLatitude())
                .longitude(user.getLongitude())
                .location(user.getLocation())
                .privacyLevel(user.getPrivacyLevel() != null ? user.getPrivacyLevel().toString() : null)
                .followersCount(user.getFollowers() != null ? user.getFollowers().size() : 0)
                .followingCount(user.getFollowing() != null ? user.getFollowing().size() : 0)
                .createdAt(user.getCreatedAt())
                .build();
    }
}
