import { PacketStream } from '../packet-stream';
import { IdentifierPacket } from '../mqtt.packet';
import { MalformedPacketError } from '../errors';

export class SubscribeResponsePacket extends IdentifierPacket {
    get anyError(): boolean {
        return !this.returnCodes.every(x => x !== SubscribeReturnCode.Fail);
    }

    constructor(
        identifier: number,
        public returnCodes: SubscribeReturnCode[],
    ) {
        super(identifier);
    }
}

export function readSubscribeResponsePacket(stream: PacketStream, remainingLength: number): SubscribeResponsePacket {
    const identifier = stream.readWord();
    const returnCodes = Array.from(stream.read(remainingLength - 2));
    if (
        !returnCodes.every(
            code =>
                code === SubscribeReturnCode.MaxQoS0 ||
                code === SubscribeReturnCode.MaxQoS1 ||
                code === SubscribeReturnCode.MaxQoS2 ||
                code === SubscribeReturnCode.Fail,
        )
    ) {
        throw new MalformedPacketError('Received invalid return codes');
    }
    return new SubscribeResponsePacket(identifier, returnCodes);
}

export enum SubscribeReturnCode {
    MaxQoS0,
    MaxQoS1,
    MaxQoS2,
    Fail = 0x80,
}
