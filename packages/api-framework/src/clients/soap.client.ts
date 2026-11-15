import type { APIRequestContext } from '@playwright/test';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ removeNSPrefix: true, parseTagValue: true });

const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Builds a SOAP 1.1 envelope, posts it, and returns the parsed <Body>. */
export class SoapClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly endpoint: string,
    private readonly namespace: string,
  ) {}

  envelope(operation: string, params: Record<string, string | number>): string {
    const fields = Object.entries(params)
      .map(([key, value]) => `<${key}>${escapeXml(String(value))}</${key}>`)
      .join('');
    return (
      '<?xml version="1.0" encoding="utf-8"?>' +
      '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
      `<soap:Body><${operation} xmlns="${this.namespace}">${fields}</${operation}></soap:Body>` +
      '</soap:Envelope>'
    );
  }

  async call(
    operation: string,
    params: Record<string, string | number>,
  ): Promise<{ status: number; body: Record<string, unknown> }> {
    const response = await this.request.post(this.endpoint, {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        SOAPAction: `"${this.namespace}${operation}"`,
        Accept: 'text/xml',
      },
      data: this.envelope(operation, params),
    });
    const parsed = parser.parse(await response.text()) as { Envelope?: { Body?: Record<string, unknown> } };
    return { status: response.status(), body: parsed.Envelope?.Body ?? {} };
  }
}
