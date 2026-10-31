import { OpenAPIObject } from '@nestjs/swagger';
import { applySwaggerResponseEnvelopes } from './swagger-envelope.util';

describe('applySwaggerResponseEnvelopes', () => {
  it('documents an envelope even when Nest did not infer a response schema', () => {
    const document = {
      paths: {
        '/categories': {
          get: { responses: { '200': { description: 'OK' } } }
        }
      }
    } as unknown as OpenAPIObject;

    applySwaggerResponseEnvelopes(document);

    const response = document.paths['/categories']?.get?.responses?.['200'] as {
      content?: Record<string, { schema?: unknown }>;
    };
    const schema = response.content?.['application/json']?.schema as {
      required?: string[];
      properties?: Record<string, unknown>;
    };
    expect(schema.required).toEqual(['success', 'data']);
    expect(schema.properties).toHaveProperty('success');
    expect(schema.properties).toHaveProperty('data');
  });

  it('leaves explicitly skipped and bodyless responses unchanged', () => {
    const document = {
      paths: {
        '/external': {
          get: {
            'x-response-envelope': false,
            responses: { '200': { description: 'external' } }
          },
          delete: { responses: { '204': { description: 'No content' } } }
        }
      }
    } as unknown as OpenAPIObject;

    applySwaggerResponseEnvelopes(document);

    const getResponse = document.paths['/external']?.get?.responses?.['200'] as {
      content?: unknown;
    };
    const deleteResponse = document.paths['/external']?.delete?.responses?.['204'] as {
      content?: unknown;
    };
    expect(getResponse.content).toBeUndefined();
    expect(deleteResponse.content).toBeUndefined();
  });
});
