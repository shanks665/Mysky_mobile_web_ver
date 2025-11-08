package com.mysky.api.service;

import com.mysky.api.dto.event.EventCreateRequest;
import com.mysky.api.dto.event.EventDto;
import com.mysky.api.dto.event.EventUpdateRequest;
import com.mysky.api.entity.Circle;
import com.mysky.api.entity.Event;
import com.mysky.api.entity.User;
import com.mysky.api.repository.CircleRepository;
import com.mysky.api.repository.EventRepository;
import com.mysky.api.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final UserRepository userRepository;
    private final CircleRepository circleRepository;

    @Transactional
    public EventDto createEvent(EventCreateRequest request, Long creatorId) {
        User creator = userRepository.findById(creatorId).orElseThrow();

        Event event = Event.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .category(request.getCategory())
                .imageUrl(request.getImageUrl())
                .startTime(request.getStartTime())
                .endTime(request.getEndTime())
                .latitude(request.getLatitude())
                .longitude(request.getLongitude())
                .location(request.getLocation())
                .venue(request.getVenue())
                .creator(creator)
                .maxAttendees(request.getMaxAttendees())
                .build();

        if (request.getCircleId() != null) {
            Circle circle = circleRepository.findById(request.getCircleId()).orElseThrow();
            event.setCircle(circle);
        }

        event = eventRepository.save(event);
        return convertToDto(event);
    }

    public EventDto getEventById(Long id) {
        Event event = eventRepository.findById(id).orElseThrow();
        return convertToDto(event);
    }

    @Transactional
    public EventDto updateEvent(Long id, EventUpdateRequest request) {
        Event event = eventRepository.findById(id).orElseThrow();

        if (request.getTitle() != null) event.setTitle(request.getTitle());
        if (request.getDescription() != null) event.setDescription(request.getDescription());
        if (request.getCategory() != null) event.setCategory(request.getCategory());
        if (request.getImageUrl() != null) event.setImageUrl(request.getImageUrl());
        if (request.getStartTime() != null) event.setStartTime(request.getStartTime());
        if (request.getEndTime() != null) event.setEndTime(request.getEndTime());
        if (request.getLatitude() != null) event.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) event.setLongitude(request.getLongitude());
        if (request.getLocation() != null) event.setLocation(request.getLocation());
        if (request.getVenue() != null) event.setVenue(request.getVenue());
        if (request.getMaxAttendees() != null) event.setMaxAttendees(request.getMaxAttendees());

        event = eventRepository.save(event);
        return convertToDto(event);
    }

    @Transactional
    public void deleteEvent(Long id) {
        eventRepository.deleteById(id);
    }

    public List<EventDto> getUpcomingEvents() {
        return eventRepository.findUpcomingEvents(LocalDateTime.now()).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<EventDto> getEventsByCategory(String category) {
        return eventRepository.findByCategory(category).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<EventDto> getEventsByCircle(Long circleId) {
        return eventRepository.findByCircleId(circleId).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<EventDto> getNearbyEvents(Double latitude, Double longitude, Double distance) {
        return eventRepository.findNearbyEvents(latitude, longitude, distance).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void attendEvent(Long eventId, Long userId) {
        Event event = eventRepository.findById(eventId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        event.getAttendees().add(user);
        eventRepository.save(event);
    }

    @Transactional
    public void cancelAttendance(Long eventId, Long userId) {
        Event event = eventRepository.findById(eventId).orElseThrow();
        User user = userRepository.findById(userId).orElseThrow();
        event.getAttendees().remove(user);
        eventRepository.save(event);
    }

    private EventDto convertToDto(Event event) {
        return EventDto.builder()
                .id(event.getId())
                .title(event.getTitle())
                .description(event.getDescription())
                .category(event.getCategory())
                .imageUrl(event.getImageUrl())
                .startTime(event.getStartTime())
                .endTime(event.getEndTime())
                .latitude(event.getLatitude())
                .longitude(event.getLongitude())
                .location(event.getLocation())
                .venue(event.getVenue())
                .creatorId(event.getCreator().getId())
                .creatorName(event.getCreator().getDisplayName())
                .circleId(event.getCircle() != null ? event.getCircle().getId() : null)
                .circleName(event.getCircle() != null ? event.getCircle().getName() : null)
                .status(event.getStatus().toString())
                .attendeesCount(event.getAttendees() != null ? event.getAttendees().size() : 0)
                .maxAttendees(event.getMaxAttendees())
                .createdAt(event.getCreatedAt())
                .build();
    }
}
