import { expectRemainingLength } from '../mqtt.utilities';

export class PingResponsePacket {}

export function readPingResponsePacket(_: unknown, remaining: number): PingResponsePacket {
    expectRemainingLength(remaining, 0);
    return new PingResponsePacket();
}
