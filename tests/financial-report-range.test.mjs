import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseFinancialReportRange } from '../lib/financial-report-range.ts';

test('accepts a valid inclusive report date range', () => {
  assert.deepEqual(parseFinancialReportRange('2026-01-01', '2026-12-31'), {
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });
});

test('rejects invalid dates, reversed ranges, and ranges over ten years', () => {
  for (const [start, end] of [
    ['2026-02-30', '2026-03-01'],
    ['2026-03-02', '2026-03-01'],
    ['2010-01-01', '2026-01-01'],
    [null, '2026-01-01'],
  ]) {
    assert.equal(parseFinancialReportRange(start, end), null);
  }
});
