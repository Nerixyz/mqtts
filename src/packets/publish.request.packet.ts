import { PacketStream } from '../packet-stream';
import { IdentifierPacket, PacketWriteResult } from '../mqtt.packet';
import { EndOfStreamError } from '../errors';
import { toBuffer } from '../mqtt.utilities';

export class PublishRequestPacket extends IdentifierPacket {

    get duplicate(): boolean {
        return !!(this.flags & 0b1000);
    }
    get qos(): 0 | 1 | 2 {
        return ((this.flags & 0b0110) >> 1) as (0 | 1 | 2);
    }
    get retain(): boolean {
        return !!(this.flags & 0b0001);
    }

    constructor(public flags: number, public topic: string, identifier: number | undefined, public payload: Buffer) {
        super(identifier ?? -1);
        if(((flags & 0b0110) >> 1) > 2)
            throw new Error('Invalid QoS');
    }
}

export interface PublishPacketOptions {
    topic: string;
    qos?: number;
    duplicate?: boolean;
    retain?: boolean;
    payload?: string | Buffer;
    identifier?: number;
}

export function writePublishRequestPacket(stream: PacketStream, options: PublishPacketOptions): PacketWriteResult {
    options.qos = options.qos ?? 0;
    stream.writeString(options.topic);
    if(options.qos > 2)
        throw new Error('Unsupported QoS');
    if(options.qos > 0) {
        if(!options.identifier)
            throw new Error('Expected identifier for QoS != 0');

        stream.writeWord(options.identifier);
    }
    stream.write(toBuffer(options.payload ?? Buffer.alloc(0)));
    return  {
        flags: (Number(!!options.duplicate) << 3) | ((options.qos & 0x3) << 1) | Number(!!options.retain),
        identifier: options.identifier,
    }
}

export function readPublishRequestPacket(stream: PacketStream, remainingLength: number, flags: number): PublishRequestPacket {
    const startPos = stream.position;
    const topic = stream.readString();
    const identifier = (flags & 0b0110) ? stream.readWord() : undefined;

    const payloadLength = remainingLength - (stream.position - startPos);
    if (payloadLength > stream.length - stream.position) throw new EndOfStreamError();
    const payload = payloadLength > 0 ? stream.read(payloadLength) : Buffer.alloc(0);
    return new PublishRequestPacket(flags, topic, identifier, payload);
}