import { OpenAPIObject } from '@nestjs/swagger';

type Operation = Record<string, unknown> & {
  responses?: Record<string, Record<string, unknown>>;
  'x-response-envelope'?: boolean;
};

export function applySwaggerResponseEnvelopes(document: OpenAPIObject): void {
  for (const path of Object.values(document.paths)) {
    if (!path) continue;
    for (const operation of Object.values(path) as Array<Operation | undefined>) {
      if (!operation?.responses || operation['x-response-envelope'] === false) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!/^2\d\d$/.test(status) || status === '204') continue;
        const content = (response.content ??= {}) as Record<
          string,
          { schema?: Record<string, unknown> }
        >;
        const json = (content['application/json'] ??= {});
        const originalSchema = json.schema ?? {};
        json.schema = {
          type: 'object',
          required: ['success', 'data'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            data: originalSchema,
            meta: {
              type: 'object',
              nullable: true,
              properties: {
                page: { type: 'integer', minimum: 1 },
                limit: { type: 'integer', minimum: 1, maximum: 100 },
                total: { type: 'integer', minimum: 0 },
                totalPages: { type: 'integer', minimum: 0 }
              }
            }
          },
          additionalProperties: true
        };
      }
    }
  }
}
