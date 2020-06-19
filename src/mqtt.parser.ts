import { MqttPacket } from './mqtt.packet';
import { PacketTypes } from './mqtt.constants';
import { PacketStream } from './packet-stream';
import { EndOfStreamError, MalformedPacketError, UnexpectedPacketError } from './errors';
import {
    ConnectResponsePacket,
    DisconnectRequestPacket,
    PingRequestPacket,
    PingResponsePacket,
    PublishAckPacket,
    PublishCompletePacket,
    PublishReceivedPacket,
    PublishReleasePacket,
    PublishRequestPacket,
    SubscribeRequestPacket,
    SubscribeResponsePacket,
    UnsubscribeRequestPacket,
    UnsubscribeResponsePacket,
} from './packets';
import { createLock } from './mqtt.utilities';
import { Transform, TransformCallback } from 'stream';
import { Debug } from 'debug';

type MqttPacketImpl = {
    new (): MqttPacket;
};

export interface MqttTransformerOptions {
    debug?: Debug;
    mapping?: { [x: number]: MqttPacketImpl };
}

export class MqttTransformer extends Transform {
    public mapping: { [x: number]: MqttPacketImpl } = {
        [PacketTypes.TYPE_CONNACK]: ConnectResponsePacket,
        [PacketTypes.TYPE_PUBLISH]: PublishRequestPacket,
        [PacketTypes.TYPE_PUBACK]: PublishAckPacket,
        [PacketTypes.TYPE_PUBREC]: PublishReceivedPacket,
        [PacketTypes.TYPE_PUBREL]: PublishReleasePacket,
        [PacketTypes.TYPE_PUBCOMP]: PublishCompletePacket,
        [PacketTypes.TYPE_SUBSCRIBE]: SubscribeRequestPacket,
        [PacketTypes.TYPE_SUBACK]: SubscribeResponsePacket,
        [PacketTypes.TYPE_UNSUBSCRIBE]: UnsubscribeRequestPacket,
        [PacketTypes.TYPE_UNSUBACK]: UnsubscribeResponsePacket,
        [PacketTypes.TYPE_PINGREQ]: PingRequestPacket,
        [PacketTypes.TYPE_PINGRESP]: PingResponsePacket,
        [PacketTypes.TYPE_DISCONNECT]: DisconnectRequestPacket,
    };

    private internalStream: PacketStream | undefined = undefined;

    constructor(private options: MqttTransformerOptions = {}) {
        super({ objectMode: true });
        this.mapping = {
            ...this.mapping,
            ...options.mapping,
        };
    }

    _transform(chunk: Buffer, encoding: string, callback: TransformCallback) {
        if (!Buffer.isBuffer(chunk)) {
            callback(new Error('Expected a Buffer'));
            return;
        }

        const stream = this.internalStream ? this.internalStream.write(chunk, false) : PacketStream.fromBuffer(chunk);
        this.internalStream = undefined;

        let startPos = 0;
        while (stream.remainingBytes > 0) {
            const type = stream.readByte() >> 4;

            const proto = this.mapping[type];
            if (!proto) {
                callback(
                    new UnexpectedPacketError(`No packet found for ${type}; @${stream.position}/${stream.length}`),
                );
                return;
            }
            const packet = new proto();

            stream.seek(-1);
            try {
                packet.read(stream);
                this.push(packet);
                stream.cut();
                startPos = stream.position;
            } catch (e) {
                if (e instanceof EndOfStreamError) {
                    this.options.debug?.(
                        `EOS:\n  ${packet.remainingPacketLength} got: ${stream.length} (+) ${chunk.byteLength};\n  return: ${startPos};`,
                    );
                    stream.position = startPos;
                    this.internalStream = stream.cut();
                    callback();
                    return;
                } else {
                    callback(
                        new MalformedPacketError(
                            `Error in parser (type: ${type}): 
                        ${e.stack}; 
                        exiting; 
                        resetting;
                        stream: ${stream.data.toString('base64')}`,
                        ),
                    );
                    return;
                }
            }
        }
        callback();
    }
}

export class MqttParser {
    protected stream: PacketStream;
    protected errorCallback: (e: Error) => void;

    protected lock = createLock();

    public mapping: [number, () => MqttPacket][] = [
        [PacketTypes.TYPE_CONNACK, () => new ConnectResponsePacket()],
        [PacketTypes.TYPE_PUBLISH, () => new PublishRequestPacket()],
        [PacketTypes.TYPE_PUBACK, () => new PublishAckPacket()],
        [PacketTypes.TYPE_PUBREC, () => new PublishReceivedPacket()],
        [PacketTypes.TYPE_PUBREL, () => new PublishReleasePacket()],
        [PacketTypes.TYPE_PUBCOMP, () => new PublishCompletePacket()],
        [PacketTypes.TYPE_SUBSCRIBE, () => new SubscribeRequestPacket()],
        [PacketTypes.TYPE_SUBACK, () => new SubscribeResponsePacket()],
        [PacketTypes.TYPE_UNSUBSCRIBE, () => new UnsubscribeRequestPacket()],
        [PacketTypes.TYPE_UNSUBACK, () => new UnsubscribeResponsePacket()],
        [PacketTypes.TYPE_PINGREQ, () => new PingRequestPacket()],
        [PacketTypes.TYPE_PINGRESP, () => new PingResponsePacket()],
        [PacketTypes.TYPE_DISCONNECT, () => new DisconnectRequestPacket()],
    ];

    public constructor(errorCallback?: (e: Error) => void, protected debug?: (msg: string) => void) {
        this.stream = PacketStream.empty();
        /* eslint @typescript-eslint/no-empty-function: "off" */
        this.errorCallback = errorCallback ?? (() => {});
    }

    public reset() {
        this.stream = PacketStream.empty();
        this.lock.locked = false;
        this.lock.resolver = null;
    }

    public async parse(data: Buffer): Promise<MqttPacket[]> {
        await this.lock.wait();
        this.lock.lock();
        let startPos = this.stream.position;
        this.stream.write(data);
        this.stream.position = startPos;
        const results: MqttPacket[] = [];
        try {
            while (this.stream.remainingBytes > 0) {
                const type = this.stream.readByte() >> 4;

                let packet: MqttPacket;
                try {
                    // @ts-ignore - if undefined -> catched
                    packet = this.mapping.find(x => x[0] === type)[1]();
                } catch (e) {
                    this.debug?.(
                        `No packet found for ${type};
                         @${this.stream.position}/${this.stream.length}
                         parsed: ${results.length}`,
                    );
                    continue;
                }

                this.stream.seek(-1);
                let exitParser = false;
                try {
                    packet.read(this.stream);
                    results.push(packet);
                    this.stream.cut();
                    startPos = this.stream.position;
                } catch (e) {
                    if (e instanceof EndOfStreamError) {
                        this.debug?.(
                            `EOS:\n  ${packet.remainingPacketLength} got: ${this.stream.length} (+) ${data.byteLength};\n  return: ${startPos};`,
                        );
                        this.stream.position = startPos;
                        exitParser = true;
                    } else {
                        this.debug?.(
                            `Error in parser (type: ${type}): 
                        ${e.stack}; 
                        exiting; 
                        resetting;
                        stream: ${this.stream.data.toString('base64')}`,
                        );

                        this.errorCallback(e);
                        exitParser = true;
                        this.stream = PacketStream.empty();
                    }
                }
                if (exitParser) break;
            }
        } catch (e) {
            this.debug?.(
                `Error in parser: 
                ${e.stack};
                 resetting; 
                 stream: ${this.stream.data.toString('base64')}`,
            );

            this.stream = PacketStream.empty();
            this.errorCallback(e);
        }
        this.lock.unlock();
        return results;
    }
}
