/**
 * Snowflake ID Generator
 * Cấu trúc 64-bit:
 * [1 bit dấu] + [41 bits Timestamp] + [10 bits Node ID] + [12 bits Sequence]
 */
export class Snowflake {
  private static readonly EPOCH = 1609459200000n; // 2021-01-01
  private static readonly NODE_ID_BITS = 10n;
  private static readonly SEQUENCE_BITS = 12n;

  private static readonly MAX_NODE_ID = (1n << Snowflake.NODE_ID_BITS) - 1n;
  private static readonly MAX_SEQUENCE = (1n << Snowflake.SEQUENCE_BITS) - 1n;

  private lastTimestamp = -1n;
  private sequence = 0n;
  private nodeId: bigint;

  constructor(nodeId: number) {
    if (nodeId < 0 || BigInt(nodeId) > Snowflake.MAX_NODE_ID) {
      throw new Error(`Node ID must be between 0 and ${Snowflake.MAX_NODE_ID}`);
    }
    this.nodeId = BigInt(nodeId);
  }

  public nextId(): string {
    let timestamp = BigInt(Date.now());

    if (timestamp < this.lastTimestamp) {
      throw new Error('Clock moved backwards!');
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & Snowflake.MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // Chờ đến mili giây tiếp theo nếu vượt quá sequence trong 1ms
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id = ((timestamp - Snowflake.EPOCH) << (Snowflake.NODE_ID_BITS + Snowflake.SEQUENCE_BITS)) |
               (this.nodeId << Snowflake.SEQUENCE_BITS) |
               this.sequence;

    return id.toString();
  }
}

// Singleton instance để dùng chung trong App
let instance: Snowflake;
export const getSnowflake = (nodeId: number = 1) => {
  if (!instance) instance = new Snowflake(nodeId);
  return instance;
};
