import { IdentifierPacket, PacketWriteResult } from '../mqtt.packet';
import { PacketStream } from '../packet-stream';
import { IdentifierData } from '../mqtt.types';
import { expectRemainingLength } from '../mqtt.utilities';

export class PublishReleasePacket extends IdentifierPacket {}

export function writePublishReleasePacket(
    stream: PacketStream,
    options: PublishReleasedPacketOptions,
): PacketWriteResult {
    stream.writeWord(options.identifier);
    return { flags: 2, identifier: options.identifier };
}

export function readPublishReleasePacket(stream: PacketStream, remaining: number): PublishReleasePacket {
    expectRemainingLength(remaining, 2);
    return new PublishReleasePacket(stream.readWord());
}

export type PublishReleasedPacketOptions = IdentifierData;
