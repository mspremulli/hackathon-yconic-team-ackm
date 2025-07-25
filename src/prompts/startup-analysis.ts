import { Prompt } from '../types/index.js';

export const startupAnalysisPrompt: Prompt = {
  name: 'analyze_startup_prompt',
  description: 'Generate a prompt for comprehensive startup analysis',
  arguments: [
    {
      name: 'startup_name',
      description: 'Name of the startup to analyze',
      required: true,
    },
    {
      name: 'focus_area',
      description: 'Specific area to focus on (e.g., market_fit, team, technology, traction)',
      required: false,
    },
  ],
  handler: async (args) => {
    const { startup_name, focus_area } = args;
    
    const systemPrompt = `You are an expert startup analyst and venture capital advisor. Your task is to analyze startups comprehensively using multiple data sources including social media, news, and web presence. Focus on providing actionable insights for investment decisions.`;
    
    let userPrompt = `Please analyze the startup "${startup_name}" using the available tools. Follow these steps:

1. Use the analyze_startup tool to gather comprehensive data about ${startup_name}
2. Review the sentiment analysis results
3. Generate a dashboard summary for quick insights
4. Provide your expert analysis including:
   - Market opportunity and positioning
   - Team strength and technical capabilities
   - Product-market fit indicators
   - Customer sentiment and traction
   - Competitive advantages
   - Risk factors
   - Investment recommendation`;
    
    if (focus_area) {
      userPrompt += `\n\nPay special attention to: ${focus_area}`;
    }
    
    return [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ];
  },
};