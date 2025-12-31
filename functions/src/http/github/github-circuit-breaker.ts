/**
 * GitHub Circuit Breaker
 *
 * Implements circuit breaker pattern for GitHub API calls
 * Prevents cascading failures during GitHub outages
 *
 * Story 7.6: Handle GitHub Outage with Graceful Degradation
 */

import { logger } from '../../shared/logger'

export enum CircuitState {
  CLOSED = 'closed', // Normal operation - requests allowed
  OPEN = 'open', // Circuit is open - requests blocked
  HALF_OPEN = 'half_open' // Testing if service recovered
}

interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures before opening circuit
  successThreshold: number // Number of successes to close circuit from half-open
  timeout: number // Time in ms before attempting to close circuit
  resetTimeout: number // Time in ms before transitioning from open to half-open
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open circuit after 5 failures
  successThreshold: 2, // Close circuit after 2 successes in half-open
  timeout: 60000, // 60 seconds timeout for requests
  resetTimeout: 300000 // 5 minutes before attempting recovery
}

class GitHubCircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0
  private lastStateChangeTime: number = Date.now()
  private config: CircuitBreakerConfig

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    // Auto-transition from OPEN to HALF_OPEN after reset timeout
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        this.transitionToHalfOpen()
      }
    }

    return this.state
  }

  /**
   * Check if request should be allowed
   */
  canExecute(): boolean {
    const currentState = this.getState()
    return currentState === CircuitState.CLOSED || currentState === CircuitState.HALF_OPEN
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++
      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed()
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success in closed state
      this.failureCount = 0
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now()
    this.failureCount++

    if (this.state === CircuitState.HALF_OPEN) {
      // If we fail in half-open, immediately go back to open
      this.transitionToOpen()
    } else if (this.state === CircuitState.CLOSED) {
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen()
      }
    }
  }

  /**
   * Transition to closed state (normal operation)
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED
    this.failureCount = 0
    this.successCount = 0
    this.lastStateChangeTime = Date.now()
    logger.info('GitHub circuit breaker: CLOSED (normal operation)', {
      state: this.state,
      failureCount: this.failureCount
    })
  }

  /**
   * Transition to open state (blocking requests)
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN
    this.successCount = 0
    this.lastStateChangeTime = Date.now()
    logger.warn('GitHub circuit breaker: OPEN (blocking requests)', {
      state: this.state,
      failureCount: this.failureCount,
      resetTimeout: this.config.resetTimeout
    })
  }

  /**
   * Transition to half-open state (testing recovery)
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN
    this.successCount = 0
    this.failureCount = 0
    this.lastStateChangeTime = Date.now()
    logger.info('GitHub circuit breaker: HALF_OPEN (testing recovery)', {
      state: this.state
    })
  }

  /**
   * Get circuit breaker status for monitoring
   */
  getStatus(): {
    state: CircuitState
    failureCount: number
    successCount: number
    lastFailureTime: number
    timeSinceLastStateChange: number
  } {
    return {
      state: this.getState(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      timeSinceLastStateChange: Date.now() - this.lastStateChangeTime
    }
  }

  /**
   * Reset circuit breaker (for testing or manual recovery)
   */
  reset(): void {
    this.transitionToClosed()
    logger.info('GitHub circuit breaker: RESET (manual reset)')
  }
}

// Singleton instance for GitHub API calls
let circuitBreakerInstance: GitHubCircuitBreaker | null = null

/**
 * Get or create circuit breaker instance
 */
export function getCircuitBreaker(): GitHubCircuitBreaker {
  if (!circuitBreakerInstance) {
    circuitBreakerInstance = new GitHubCircuitBreaker()
  }
  return circuitBreakerInstance
}

/**
 * Reset circuit breaker (for testing or manual recovery)
 */
export function resetCircuitBreaker(): void {
  if (circuitBreakerInstance) {
    circuitBreakerInstance.reset()
  }
}
