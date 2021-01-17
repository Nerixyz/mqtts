import { PacketStream } from '../packet-stream';
import { expectRemainingLength } from '../mqtt.utilities';

export class ConnectResponsePacket {
    get sessionPresent(): boolean {
        return !!(this.ackFlags & 0x1);
    }
    get isSuccess(): boolean {
        return this.returnCode === ConnectReturnCode.Accepted;
    }
    get errorName(): keyof typeof ConnectReturnCode | string {
        return Object.entries(ConnectReturnCode).find(([, v]) => v === this.returnCode)?.[0] ?? 'Unknown';
    }
    constructor(public ackFlags: number, public returnCode: ConnectReturnCode) {}
}

export function readConnectResponsePacket(stream: PacketStream, remaining: number): ConnectResponsePacket {
    expectRemainingLength(remaining, 2);
    const ack = stream.readByte();
    const returnCode = stream.readByte();
    if (ack > 1) {
        throw new Error('Invalid ack');
    } else if (returnCode > 5) {
        throw new Error('Invalid return code');
    }
    return new ConnectResponsePacket(ack, returnCode as ConnectReturnCode);
}

export enum ConnectReturnCode {
    Accepted,
    UnacceptableProtocolVersion,
    IdentifierRejected,
    ServerUnavailable,
    BadUsernameOrPassword,
    NotAuthorized,
}
