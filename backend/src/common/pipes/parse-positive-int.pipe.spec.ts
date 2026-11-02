import { BadRequestException } from '@nestjs/common';
import { ParsePositiveIntPipe } from './parse-positive-int.pipe';

describe('ParsePositiveIntPipe', () => {
  const pipe = new ParsePositiveIntPipe();
  const metadata = { type: 'param' as const, data: 'id' };

  it('accepts positive decimal integers without changing the service input type', () => {
    expect(pipe.transform('123', metadata)).toBe('123');
  });

  it.each(['abc', '1.5', '-1', '0', ''])('rejects invalid ID %s', (value) => {
    expect(() => pipe.transform(value, metadata)).toThrow(BadRequestException);
  });
});
