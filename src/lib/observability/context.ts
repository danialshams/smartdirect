import { AsyncLocalStorage } from "node:async_hooks";

export type ObservabilityContext = {
  correlationId?: string;
  requestId?: string;
  jobId?: string;
  tenantId?: string;
  instagramAccountId?: string;
};

const storage = new AsyncLocalStorage<ObservabilityContext>();

export function createCorrelationId() {
  return crypto.randomUUID();
}

export function createRequestId() {
  return `req_${Date.now()}_${crypto.randomUUID()}`;
}

export function getObservabilityContext(): ObservabilityContext {
  return storage.getStore() ?? {};
}

export function runWithObservabilityContext<T>(
  context: ObservabilityContext,
  work: () => Promise<T>,
): Promise<T> {
  return storage.run(
    {
      ...getObservabilityContext(),
      ...context,
    },
    work,
  );
}

export function mergeObservabilityContext(
  context: ObservabilityContext,
): ObservabilityContext {
  return {
    ...getObservabilityContext(),
    ...context,
  };
}

export function getRequestObservabilityContext(request: Request) {
  const correlationId =
    request.headers.get("x-correlation-id")?.trim() || createCorrelationId();
  const requestId =
    request.headers.get("x-request-id")?.trim() || createRequestId();

  return {
    correlationId,
    requestId,
  };
}
