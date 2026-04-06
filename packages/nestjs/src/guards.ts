import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { LLMAdapter } from '@orka-js/core';

/**
 * OrkaSemanticGuard — HTTP request guard powered by an LLM.
 *
 * Instead of rule-based authorization, this guard describes the incoming request
 * to an LLM and asks whether it should be ALLOWED or DENIED given a policy string.
 * This enables semantic, context-aware authorization that understands intent.
 *
 * Uses a single `llm.generate()` call (no agent loop) for minimal latency.
 * Responds to ALLOW or DENY, with fail-closed behavior on LLM errors.
 *
 * @example
 * ```typescript
 * // Inline usage
 * @Controller('admin')
 * @UseGuards(new OrkaSemanticGuard(llm, 'Only allow requests from authenticated admin users'))
 * class AdminController {}
 *
 * // Via DI (requires manual provider setup)
 * providers: [
 *   {
 *     provide: APP_GUARD,
 *     useFactory: (llm: LLMAdapter) =>
 *       new OrkaSemanticGuard(llm, 'Block any request that appears malicious'),
 *     inject: [LLM_ADAPTER_TOKEN],
 *   }
 * ]
 * ```
 */
@Injectable()
export class OrkaSemanticGuard implements CanActivate {
  constructor(
    private readonly llm: LLMAdapter,
    private readonly policy: string,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      url: string;
      body: unknown;
      headers: Record<string, string | string[] | undefined>;
    }>();

    const { method, url, body, headers } = request;
    const authHeader = headers['authorization'] ?? 'none';
    const bodySnippet = body ? JSON.stringify(body).slice(0, 500) : 'empty';

    const prompt = [
      `Policy: ${this.policy}`,
      '',
      'Evaluate the following HTTP request against the policy above.',
      'Respond with exactly one word: ALLOW or DENY.',
      '',
      `Method: ${method}`,
      `URL: ${url}`,
      `Authorization: ${authHeader}`,
      `Body: ${bodySnippet}`,
    ].join('\n');

    try {
      const result = await this.llm.generate(prompt, {
        maxTokens: 10,
        temperature: 0,
        systemPrompt: 'You are a security policy enforcer. Respond only with ALLOW or DENY.',
      });

      return result.content.toUpperCase().includes('ALLOW');
    } catch {
      // Fail-closed: if the LLM is unavailable, deny the request
      return false;
    }
  }
}
