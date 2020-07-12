import { IdentifierPacket, PacketWriteResult } from '../mqtt.packet';
import { PacketStream } from '../packet-stream';
import { IdentifierData } from '../mqtt.types';
import { expectRemainingLength } from '../mqtt.utilities';

export class PublishAckPacket extends IdentifierPacket {}

export function writePublishAckPacket(stream: PacketStream, options: PublishAckPacketOptions): PacketWriteResult {
    stream.writeWord(options.identifier);
    return { identifier: options.identifier };
}

export function readPublishAckPacket(stream: PacketStream, remaining: number): PublishAckPacket {
    expectRemainingLength(remaining, 2);
    return new PublishAckPacket(stream.readWord());
}

export type PublishAckPacketOptions = IdentifierData;
