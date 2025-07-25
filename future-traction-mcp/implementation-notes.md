# Implementation Notes for Traction MCP

## Quick Implementation Plan (4-6 hours)

### Phase 1: Basic DB Connection (1 hour)
```typescript
// Simple connection manager
class DatabaseConnector {
  async connect(config: DBConfig) {
    // Auto-detect DB type from connection string
    // Use Prisma introspection to get schema
    // Return standardized interface
  }
  
  async getMetrics() {
    // Pre-defined queries for common metrics
    return {
      customerCount: await this.query("SELECT COUNT(*) FROM users"),
      activeCustomers: await this.query("SELECT COUNT(*) FROM users WHERE last_active > ?", [thirtyDaysAgo]),
      // etc.
    };
  }
}
```

### Phase 2: Claude Schema Mapping (30 min)
```typescript
// Use Claude to map any schema to our standard
async function generateSchemaMapping(tables: TableInfo[]) {
  const prompt = `Given these tables: ${JSON.stringify(tables)}
    Map to our standard schema:
    - customer table name
    - subscription/payment table
    - created_at field name
    - revenue field name`;
    
  return await claude.complete(prompt);
}
```

### Phase 3: Metric Calculations (1 hour)
```typescript
// Standard metrics every VC wants
class MetricsCalculator {
  calculateMRR(subscriptions: Subscription[]) { }
  calculateChurn(customers: Customer[]) { }
  calculateLTV(revenue: Revenue[], churn: number) { }
  calculateCAC(marketing: Marketing[], customers: number) { }
}
```

### Phase 4: Document Processing (1 hour)
```typescript
// Senso.ai integration for P&L, contracts
async function processFinancialDocs(pdf: Buffer) {
  const context = await senso.ingest({
    document: pdf,
    type: 'financial_statement',
    extract: [
      'total_revenue',
      'recurring_revenue', 
      'gross_margin',
      'burn_rate',
      'runway_months'
    ]
  });
  
  return context.extracted_data;
}
```

### Phase 5: Analytics APIs (30 min)
```typescript
// Google Analytics connection
async function getWebMetrics(ga_property_id: string) {
  // Traffic trends
  // Conversion rates
  // User engagement
  // Geographic distribution
}

// Stripe connection  
async function getPaymentMetrics(stripe_key: string) {
  // MRR/ARR
  // Churn
  // Failed payments
}
```

### Phase 6: Security Wrapper (1 hour)
```typescript
// Temporal workflow for time-limited access
class TractionWorkflow {
  async execute(credentials: EncryptedCreds, duration: string) {
    // Decrypt credentials
    // Run analysis
    // Auto-cleanup after duration
    // Return results
  }
}
```

## MCP Tool Definitions

```typescript
export const tools = [
  {
    name: 'analyze_traction',
    description: 'Analyze startup traction from real data sources',
    inputSchema: z.object({
      db_connection: z.string().optional(),
      stripe_key: z.string().optional(),
      ga_property: z.string().optional(),
      financial_docs: z.array(z.string()).optional(),
      duration_hours: z.number().default(24)
    })
  },
  
  {
    name: 'quick_metrics',
    description: 'Get quick metrics from a SQL database',
    inputSchema: z.object({
      connection_string: z.string(),
      table_hints: z.object({
        customers: z.string(),
        revenue: z.string()
      }).optional()
    })
  }
];
```

## Sample Output

```json
{
  "company": "Acme SaaS",
  "analysis_date": "2024-01-25",
  "data_sources": ["postgresql", "stripe", "google_analytics"],
  
  "metrics": {
    "customers": {
      "total": 487,
      "paying": 423,
      "trial": 64,
      "growth_30d": 23.4,
      "growth_90d": 67.2
    },
    "revenue": {
      "mrr": 48500,
      "arr": 582000,
      "arpu": 114.66,
      "growth_rate": 0.18
    },
    "retention": {
      "logo_churn_monthly": 0.04,
      "revenue_churn_monthly": 0.02,
      "net_revenue_retention": 1.08
    },
    "efficiency": {
      "cac": 1200,
      "ltv": 8500,
      "ltv_cac": 7.08,
      "payback_months": 10.5,
      "magic_number": 0.72
    }
  },
  
  "insights": {
    "positive": [
      "Strong net revenue retention (108%)",
      "LTV:CAC ratio above 3:1 threshold",
      "Consistent month-over-month growth"
    ],
    "concerns": [
      "CAC increasing 15% QoQ",
      "Enterprise segment showing higher churn",
      "Runway: 14 months at current burn"
    ]
  }
}
```

## Integration Points

1. **With Social MCP**: Cross-reference claimed traction with actual
2. **With Market MCP**: Validate TAM assumptions with real growth
3. **With Orchestrator**: Provide "trust score" for claims