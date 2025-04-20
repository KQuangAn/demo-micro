export interface EventBridgePayload<T = any> {
    source: string;
    detailType: string;
    detail: T;
  }
  
  export function buildEventBridgePayload<T>(source: string, detailType: string, detail: T): EventBridgePayload<T> {
    return {
      source,
      detailType,
      detail,
    };
  }
  