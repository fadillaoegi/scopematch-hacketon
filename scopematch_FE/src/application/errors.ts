// Semantic gateway failures are independent of HTTP status and React.
export class GatewayError extends Error {
  constructor(public code: string, public fields: Record<string, string> = {}) {
    super(code)
    this.name = 'GatewayError'
  }
}
