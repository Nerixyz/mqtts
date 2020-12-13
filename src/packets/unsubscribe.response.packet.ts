import { IdentifierPacket } from '../mqtt.packet';
import { PacketStream } from '../packet-stream';
import { expectRemainingLength } from '../mqtt.utilities';

export class UnsubscribeResponsePacket extends IdentifierPacket {}

export function readUnsubscribePacket(stream: PacketStream, remaining: number): UnsubscribeResponsePacket {
    expectRemainingLength(remaining, 2);
    return new UnsubscribeResponsePacket(stream.readWord());
}
