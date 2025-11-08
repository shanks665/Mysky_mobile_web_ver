package com.mysky.api.service;

import com.mysky.api.dto.circle.CircleCreateRequest;
import com.mysky.api.dto.circle.CircleDto;
import com.mysky.api.dto.circle.CircleUpdateRequest;
import com.mysky.api.entity.Circle;
import com.mysky.api.entity.User;
import com.mysky.api.repository.CircleRepository;
import com.mysky.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CircleService {

    private final CircleRepository circleRepository;
    private final UserRepository userRepository;

    @Transactional
    public CircleDto createCircle(CircleCreateRequest request, Long creatorId) {
        User creator = userRepository.findById(creatorId).orElseThrow();

        Circle circle = Circle.builder()
                .name(request.getName())
                .description(request.getDescription())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .location(request.getLocation())
                .creator(creator)
                .privacyLevel(request.getPrivacyLevel() != null ? 
                    Circle.PrivacyLevel.valueOf(request.getPrivacyLevel()) : Circle.PrivacyLevel.PUBLIC)
                .build();

        circle.getMembers().add(creator);
        circle.getAdmins().add(creator);

        circle = circleRepository.save(circle);
        return convertToDto(circle);
    }

    public CircleDto getCircleById(Long id) {
        Circle circle = circleRepository.findById(id).orElseThrow();
        return convertToDto(circle);
    }

    @Transactional
    public CircleDto updateCircle(Long id, CircleUpdateRequest request) {
        Circle circle = circleRepository.findById(id).orElseThrow();

        if (request.getName() != null) circle.setName(request.getName());
        if (request.getDescription() != null) circle.setDescription(request.getDescription());
        if (request.getCategory() != null) circle.setCategory(request.getCategory());
        if (request.getImageUrl() != null) circle.setImageUrl(request.getImageUrl());
        if (request.getLatitude() != null) circle.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) circle.setLongitude(request.getLongitude());
        if (request.getLocation() != null) circle.setLocation(request.getLocation());

        circle = circleRepository.save(circle);
        return convertToDto(circle);
    }

    @Transactional
    public void deleteCircle(Long id) {
        circleRepository.deleteById(id);
    }

    public List<CircleDto> getAllCircles() {
        return circleRepository.findAll().stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<CircleDto> searchCircles(String query) {
        return circleRepository.findByNameContainingIgnoreCase(query).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<CircleDto> getNearbyCircles(Double latitude, Double longitude, Double distance) {
        return circleRepository.findNearbyCircles(latitude, longitude, distance).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<CircleDto> getCirclesByCategory(String category) {
        return circleRepository.findByCategory(category).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<CircleDto> getMyCircles(Long userId) {
        return circleRepository.findByMemberId(userId).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void joinCircle(Long circleId, Long userId) {
        Circle circle = circleRepository.findById(circleId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        circle.getMembers().add(user);
        circleRepository.save(circle);
    }

    @Transactional
    public void leaveCircle(Long circleId, Long userId) {
        Circle circle = circleRepository.findById(circleId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        circle.getMembers().remove(user);
        circleRepository.save(circle);
    }

    private CircleDto convertToDto(Circle circle) {
        return CircleDto.builder()
                .id(circle.getId())
                .name(circle.getName())
                .description(circle.getDescription())
                .category(circle.getCategory())
                .imageUrl(circle.getImageUrl())
                .latitude(circle.getLatitude())
                .longitude(circle.getLongitude())
                .location(circle.getLocation())
                .creatorId(circle.getCreator().getId())
                .creatorName(circle.getCreator().getDisplayName())
                .privacyLevel(circle.getPrivacyLevel().toString())
                .membersCount(circle.getMembers() != null ? circle.getMembers().size() : 0)
                .createdAt(circle.getCreatedAt())
                .build();
    }
}
