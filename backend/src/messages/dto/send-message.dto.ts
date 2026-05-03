import { IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
}

export class SendMessageDto {
  @IsInt()
  trip_id: number;

  @IsInt()
  receiver_id: number;

  @IsString()
  @MinLength(1)
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;
}
