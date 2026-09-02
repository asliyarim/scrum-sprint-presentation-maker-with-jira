package com.aksa.capacityplanner.common.web;

import com.aksa.capacityplanner.asset.adapter.out.storage.StorageException;
import com.aksa.capacityplanner.common.domain.ConflictException;
import com.aksa.capacityplanner.common.domain.DomainValidationException;
import com.aksa.capacityplanner.common.domain.NotFoundException;
import com.aksa.capacityplanner.document.adapter.out.storage.DocumentStorageException;
import com.aksa.capacityplanner.jiraintegration.domain.JiraAccessDeniedException;
import com.aksa.capacityplanner.jiraintegration.domain.JiraSyncRateLimitedException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiErrorResponse> handleConflict(ConflictException ex, HttpServletRequest request) {
        return build(HttpStatus.CONFLICT, ex.getMessage(), request);
    }

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleNotFound(NotFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, ex.getMessage(), request);
    }

    @ExceptionHandler({DomainValidationException.class, IllegalArgumentException.class})
    public ResponseEntity<ApiErrorResponse> handleBadRequest(RuntimeException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, ex.getMessage(), request);
    }

    @ExceptionHandler(StorageException.class)
    public ResponseEntity<ApiErrorResponse> handleStorageError(StorageException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_GATEWAY, ex.getMessage(), request);
    }

    @ExceptionHandler(DocumentStorageException.class)
    public ResponseEntity<ApiErrorResponse> handleDocumentStorageError(DocumentStorageException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_GATEWAY, ex.getMessage(), request);
    }

    @ExceptionHandler(JiraSyncRateLimitedException.class)
    public ResponseEntity<ApiErrorResponse> handleJiraSyncRateLimited(JiraSyncRateLimitedException ex, HttpServletRequest request) {
        return build(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage(), request, HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()));
    }

    @ExceptionHandler(JiraAccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleJiraAccessDenied(JiraAccessDeniedException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_GATEWAY, ex.getMessage(), request);
    }

    private ResponseEntity<ApiErrorResponse> build(HttpStatus status, String message, HttpServletRequest request) {
        ApiErrorResponse body = new ApiErrorResponse(
                Instant.now(), status.value(), status.getReasonPhrase(), message, request.getRequestURI());
        return ResponseEntity.status(status).body(body);
    }

    private ResponseEntity<ApiErrorResponse> build(HttpStatus status, String message, HttpServletRequest request,
                                                     String headerName, String headerValue) {
        ApiErrorResponse body = new ApiErrorResponse(
                Instant.now(), status.value(), status.getReasonPhrase(), message, request.getRequestURI());
        return ResponseEntity.status(status).header(headerName, headerValue).body(body);
    }
}
