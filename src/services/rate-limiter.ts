import { EventEmitter } from 'events';

interface QueueItem {
  id: string;
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  retries: number;
}

interface RateLimiterOptions {
  maxRequestsPerMinute?: number;
  maxRequestsPerSecond?: number;
  maxRetries?: number;
  retryDelay?: number;
  backoffMultiplier?: number;
}

export class RateLimiter extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing = false;
  private requestCounts = {
    perSecond: 0,
    perMinute: 0
  };
  
  private options: Required<RateLimiterOptions> = {
    maxRequestsPerMinute: 60,
    maxRequestsPerSecond: 2,
    maxRetries: 3,
    retryDelay: 1000, // 1 second
    backoffMultiplier: 2
  };

  constructor(options?: RateLimiterOptions) {
    super();
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Reset counters
    setInterval(() => {
      this.requestCounts.perSecond = 0;
    }, 1000);
    
    setInterval(() => {
      this.requestCounts.perMinute = 0;
    }, 60000);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = Math.random().toString(36).substring(7);
      this.queue.push({
        id,
        fn,
        resolve,
        reject,
        retries: 0
      });
      
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      // Check rate limits
      if (this.requestCounts.perSecond >= this.options.maxRequestsPerSecond) {
        await this.delay(1000);
        continue;
      }
      
      if (this.requestCounts.perMinute >= this.options.maxRequestsPerMinute) {
        await this.delay(5000);
        continue;
      }
      
      const item = this.queue.shift()!;
      
      try {
        // Increment counters
        this.requestCounts.perSecond++;
        this.requestCounts.perMinute++;
        
        // Execute function
        const result = await item.fn();
        item.resolve(result);
        
        // Small delay between requests
        await this.delay(Math.floor(1000 / this.options.maxRequestsPerSecond));
        
      } catch (error: any) {
        // Check if it's a rate limit error
        if (this.isRateLimitError(error) && item.retries < this.options.maxRetries) {
          item.retries++;
          const delay = this.options.retryDelay * Math.pow(this.options.backoffMultiplier, item.retries - 1);
          
          console.error(`Rate limit hit, retrying in ${delay}ms (attempt ${item.retries}/${this.options.maxRetries})`);
          
          // Put back in queue with delay
          setTimeout(() => {
            this.queue.unshift(item);
            this.process();
          }, delay);
        } else {
          item.reject(error);
        }
      }
    }
    
    this.processing = false;
  }

  private isRateLimitError(error: any): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    return errorMessage.includes('rate limit') || 
           errorMessage.includes('too many requests') ||
           error.statusCode === 429;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  clearQueue(): void {
    this.queue = [];
  }
}

// Create singleton instances for different services
export const bedrockRateLimiter = new RateLimiter({
  maxRequestsPerMinute: 30, // Adjust based on your AWS limits
  maxRequestsPerSecond: 1,
  maxRetries: 3,
  retryDelay: 2000,
  backoffMultiplier: 2
});

export const socialMediaRateLimiter = new RateLimiter({
  maxRequestsPerMinute: 60,
  maxRequestsPerSecond: 2,
  maxRetries: 2,
  retryDelay: 1000
});