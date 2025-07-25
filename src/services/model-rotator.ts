interface ModelStats {
  requestCount: number;
  lastRequestTime: number;
  recentErrors: number;
  isAvailable: boolean;
}

export class ModelRotator {
  private models = new Map<string, ModelStats>();
  private currentIndex = 0;
  private modelList: string[] = [];
  
  constructor(models: string[]) {
    this.modelList = models;
    models.forEach(model => {
      this.models.set(model, {
        requestCount: 0,
        lastRequestTime: 0,
        recentErrors: 0,
        isAvailable: true
      });
    });
    
    // Reset error counts every minute
    setInterval(() => {
      this.models.forEach(stats => {
        stats.recentErrors = Math.max(0, stats.recentErrors - 1);
        if (stats.recentErrors === 0) {
          stats.isAvailable = true;
        }
      });
    }, 60000);
  }
  
  getNextModel(): string {
    // Try to find an available model
    for (let i = 0; i < this.modelList.length; i++) {
      const index = (this.currentIndex + i) % this.modelList.length;
      const model = this.modelList[index];
      const stats = this.models.get(model)!;
      
      // Check if model is available and hasn't been used too recently
      const timeSinceLastRequest = Date.now() - stats.lastRequestTime;
      if (stats.isAvailable && timeSinceLastRequest > 1000) { // 1 second cooldown
        this.currentIndex = (index + 1) % this.modelList.length;
        return model;
      }
    }
    
    // If no model is available, return the one with least errors
    let bestModel = this.modelList[0];
    let minErrors = Infinity;
    
    this.models.forEach((stats, model) => {
      if (stats.recentErrors < minErrors) {
        minErrors = stats.recentErrors;
        bestModel = model;
      }
    });
    
    return bestModel;
  }
  
  recordRequest(model: string, success: boolean) {
    const stats = this.models.get(model);
    if (!stats) return;
    
    stats.requestCount++;
    stats.lastRequestTime = Date.now();
    
    if (!success) {
      stats.recentErrors++;
      if (stats.recentErrors >= 3) {
        stats.isAvailable = false;
        console.error(`Model ${model} marked as unavailable due to errors`);
      }
    } else {
      // Success reduces error count
      stats.recentErrors = Math.max(0, stats.recentErrors - 0.5);
    }
  }
  
  getStats() {
    const result: any = {};
    this.models.forEach((stats, model) => {
      result[model] = {
        ...stats,
        timeSinceLastRequest: Date.now() - stats.lastRequestTime
      };
    });
    return result;
  }
}

// Create a singleton instance for sentiment analysis
export const sentimentModelRotator = new ModelRotator([
  'anthropic.claude-3-5-sonnet-20240620-v1:0',
  'mistral.mistral-large-2402-v1:0'
]);