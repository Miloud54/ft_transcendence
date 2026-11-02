import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class ParsePositiveIntPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (metadata.type !== 'param' || !/^[1-9]\d*$/.test(value)) {
      throw new BadRequestException(
        'Validation failed (positive integer string is expected)',
      );
    }

    return value;
  }
}
