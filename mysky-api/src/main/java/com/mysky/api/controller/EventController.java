package com.mysky.api.controller;

import com.mysky.api.dto.common.ApiResponse;
import com.mysky.api.dto.event.EventCreateRequest;
import com.mysky.api.dto.event.EventDto;
import com.mysky.api.dto.event.EventUpdateRequest;
import com.mysky.api.service.EventService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;

    @PostMapping
    public ResponseEntity<ApiResponse<EventDto>> createEvent(
            @Valid @RequestBody EventCreateRequest request,
            Authentication authentication) {
        Long creatorId = 1L; // Get from authentication
        EventDto event = eventService.createEvent(request, creatorId);
        return ResponseEntity.ok(ApiResponse.success("Event created", event));
    }

    @GetMapping("/{eventId}")
    public ResponseEntity<ApiResponse<EventDto>> getEventById(@PathVariable Long eventId) {
        EventDto event = eventService.getEventById(eventId);
        return ResponseEntity.ok(ApiResponse.success(event));
    }

    @PutMapping("/{eventId}")
    public ResponseEntity<ApiResponse<EventDto>> updateEvent(
            @PathVariable Long eventId,
            @RequestBody EventUpdateRequest request) {
        EventDto event = eventService.updateEvent(eventId, request);
        return ResponseEntity.ok(ApiResponse.success("Event updated", event));
    }

    @DeleteMapping("/{eventId}")
    public ResponseEntity<ApiResponse<Void>> deleteEvent(@PathVariable Long eventId) {
        eventService.deleteEvent(eventId);
        return ResponseEntity.ok(ApiResponse.success("Event deleted", null));
    }

    @GetMapping("/upcoming")
    public ResponseEntity<ApiResponse<List<EventDto>>> getUpcomingEvents() {
        List<EventDto> events = eventService.getUpcomingEvents();
        return ResponseEntity.ok(ApiResponse.success(events));
    }

    @GetMapping("/category/{category}")
    public ResponseEntity<ApiResponse<List<EventDto>>> getEventsByCategory(@PathVariable String category) {
        List<EventDto> events = eventService.getEventsByCategory(category);
        return ResponseEntity.ok(ApiResponse.success(events));
    }

    @GetMapping("/circle/{circleId}")
    public ResponseEntity<ApiResponse<List<EventDto>>> getEventsByCircle(@PathVariable Long circleId) {
        List<EventDto> events = eventService.getEventsByCircle(circleId);
        return ResponseEntity.ok(ApiResponse.success(events));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<EventDto>>> getNearbyEvents(
            @RequestParam Double latitude,
            @RequestParam Double longitude,
            @RequestParam(defaultValue = "10.0") Double radius) {
        List<EventDto> events = eventService.getNearbyEvents(latitude, longitude, radius);
        return ResponseEntity.ok(ApiResponse.success(events));
    }

    @PostMapping("/{eventId}/attend")
    public ResponseEntity<ApiResponse<Void>> attendEvent(
            @PathVariable Long eventId,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        eventService.attendEvent(eventId, userId);
        return ResponseEntity.ok(ApiResponse.success("Event attendance confirmed", null));
    }

    @DeleteMapping("/{eventId}/attend")
    public ResponseEntity<ApiResponse<Void>> cancelAttendance(
            @PathVariable Long eventId,
            Authentication authentication) {
        Long userId = 1L; // Get from authentication
        eventService.cancelAttendance(eventId, userId);
        return ResponseEntity.ok(ApiResponse.success("Event attendance cancelled", null));
    }
}
