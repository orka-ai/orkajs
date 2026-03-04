import type { AssertionResult } from './assertions.js';

export interface TestCaseReport {
  input: string;
  output: string;
  passed: boolean;
  assertions: AssertionResult[];
  metrics: Record<string, number>;
  latencyMs: number;
  totalTokens: number;
}

export interface TestSuiteReport {
  name: string;
  timestamp: string;
  duration: number;
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  cases: TestCaseReport[];
  summary: {
    averageLatencyMs: number;
    totalTokens: number;
    metrics: Record<string, { average: number; min: number; max: number }>;
  };
}

export interface Reporter {
  report(suite: TestSuiteReport): void | Promise<void>;
}

export class ConsoleReporter implements Reporter {
  report(suite: TestSuiteReport): void {
    const statusIcon = suite.failed === 0 ? '✅' : '❌';
    console.log(`\n${statusIcon} Test Suite: ${suite.name}`);
    console.log(`   ${suite.passed}/${suite.totalCases} passed (${(suite.passRate * 100).toFixed(1)}%)`);
    console.log(`   Duration: ${suite.duration}ms | Tokens: ${suite.summary.totalTokens}`);
    console.log('');

    for (const testCase of suite.cases) {
      const icon = testCase.passed ? '  ✅' : '  ❌';
      console.log(`${icon} "${testCase.input.slice(0, 60)}${testCase.input.length > 60 ? '...' : ''}"`);

      for (const assertion of testCase.assertions) {
        const aIcon = assertion.passed ? '    ✓' : '    ✗';
        console.log(`${aIcon} ${assertion.message}`);
      }
    }

    if (Object.keys(suite.summary.metrics).length > 0) {
      console.log('\n   Metrics:');
      for (const [name, stats] of Object.entries(suite.summary.metrics)) {
        console.log(`     ${name}: avg=${stats.average.toFixed(3)} min=${stats.min.toFixed(3)} max=${stats.max.toFixed(3)}`);
      }
    }

    console.log('');
  }
}

export class JsonReporter implements Reporter {
  private outputPath?: string;

  constructor(outputPath?: string) {
    this.outputPath = outputPath;
  }

  async report(suite: TestSuiteReport): Promise<void> {
    const json = JSON.stringify(suite, null, 2);

    if (this.outputPath) {
      const fs = await import('fs/promises');
      await fs.writeFile(this.outputPath, json, 'utf-8');
      console.log(`Report written to ${this.outputPath}`);
    } else {
      console.log(json);
    }
  }
}

export class JUnitReporter implements Reporter {
  private outputPath: string;

  constructor(outputPath: string) {
    this.outputPath = outputPath;
  }

  async report(suite: TestSuiteReport): Promise<void> {
    const xml = this.toXml(suite);
    const fs = await import('fs/promises');
    await fs.writeFile(this.outputPath, xml, 'utf-8');
    console.log(`JUnit report written to ${this.outputPath}`);
  }

  private toXml(suite: TestSuiteReport): string {
    const failures = suite.cases.filter(c => !c.passed);
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<testsuite name="${this.escapeXml(suite.name)}" tests="${suite.totalCases}" failures="${failures.length}" time="${(suite.duration / 1000).toFixed(3)}" timestamp="${suite.timestamp}">\n`;

    for (const testCase of suite.cases) {
      xml += `  <testcase name="${this.escapeXml(testCase.input)}" time="${(testCase.latencyMs / 1000).toFixed(3)}">\n`;

      const failedAssertions = testCase.assertions.filter(a => !a.passed);
      if (failedAssertions.length > 0) {
        for (const assertion of failedAssertions) {
          xml += `    <failure message="${this.escapeXml(assertion.message)}" type="${this.escapeXml(assertion.name)}">\n`;
          xml += `      Expected: ${assertion.expected ?? 'N/A'}\n`;
          xml += `      Actual: ${assertion.actual ?? 'N/A'}\n`;
          xml += `    </failure>\n`;
        }
      }

      xml += `  </testcase>\n`;
    }

    xml += `</testsuite>\n`;
    return xml;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
