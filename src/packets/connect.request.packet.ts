import { PacketWriteResult } from '../mqtt.packet';
import { PacketStream } from '../packet-stream';
import { MalformedPacketError } from '../errors';
import { notUndefined, toBuffer } from '../mqtt.utilities';

export type ConnectRequestOptions = Partial<RequiredConnectRequestOptions>;

export interface RequiredConnectRequestOptions {
    protocolLevel: number;
    protocolName: string;
    clientId: string;
    keepAlive: number;
    will?: {
        topic: string,
        message: Buffer | string,
        retained?: boolean,
        qosLevel?: number,
    };
    username?: string;
    password?: Buffer | string;
    clean: boolean;
    connectDelay?: number;
}

export function writeConnectPacket(stream: PacketStream, options: RequiredConnectRequestOptions): PacketWriteResult {
    // Variable Header
    stream
        .writeString(options.protocolName)
        .writeByte(options.protocolLevel)
        .writeByte(makeFlags(options))
        .writeWord(options.keepAlive);


    // Payload
    stream.writeString(options.clientId);
    options.will && stream
            .writeString(options.will.topic)
            .writeRawAndLength(toBuffer(options.will.message));
    options.username && stream.writeString(options.username);
    options.password && stream.writeRawAndLength(toBuffer(options.password));

    return {};
}

export function makeFlags(options: ConnectRequestOptions): number {
    if (!options) return 0;
    if(notUndefined(options.password) && !notUndefined(options.username))
        throw new MalformedPacketError('MQTT-3.1.2-22 If the User Name Flag is set to 0, the Password Flag MUST be set to 0');

    let flags = 0;
    if (notUndefined(options.username)) flags |= 0x1 << 7;
    if (notUndefined(options.password)) flags |= 0x1 << 6;
    if (notUndefined(options.will)) {
        if (options.will.retained) flags |= 0x1 << 5;

        flags |= ((options.will.qosLevel ?? 0) & 0x03) << 3;
        flags |= 0x1 << 2;
    }
    if (options.clean) flags |= 0x1 << 1;

    return flags;
}
